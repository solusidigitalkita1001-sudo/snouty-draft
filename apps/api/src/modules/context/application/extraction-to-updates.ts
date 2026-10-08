/**
 * Mengubah keluaran ekstraksi (skema `ai`) menjadi pembaruan field untuk `ContextMerger`.
 *
 * `undefined` = "tidak disebut di pesan ini" dan tidak menghasilkan pembaruan; `null`
 * tidak pernah datang dari skema (`optional`, bukan `nullable`).
 *
 * **Pagar grounding.** Model kecil gemar "melengkapi": dari "Rumah 2 lantai, 3 kamar
 * mandi" ia menulis `floorHeightM: 3` dan `mainRunMeters: 0` — angka yang tidak pernah
 * diucapkan pengguna, lalu masuk state sebagai `user_stated`. Prompt sudah melarangnya,
 * tetapi larangan di prompt dianggap tidak ada (docs/AI_BEHAVIOR.md): field yang hanya
 * bermakna bila pengguna menyebut hal itu dibuang bila pesannya tidak memuat
 * penandanya. Laju halusinasi harus 0% (docs/EVALUATION.md), dan ini salah satu pagarnya.
 */

import type { Extraction } from '../../ai/domain/extraction-schema.js';
import type { FieldUpdate } from '../domain/context-merger.js';

/** Penanda kata yang harus ada di pesan sebelum field ini dipercaya. */
const GROUNDING: Readonly<Record<string, RegExp>> = {
  // Penanda Indonesia DAN Inggris (Fase 15, P15-03): pemahaman dua bahasa hidup di pola kode.
  'building.floorHeightM': /\b(tinggi|ketinggian|meter|metre|height|\d\s*m\b)/i,
  'building.dimensions': /\b(meter|metre|\d\s*m\b|panjang|jarak|jalur|length|distance|run)/i,
  'fixtures.outletCount': /\b(titik|outlet|keran|kran|taps?|faucets?|points?)/i,
  'water.boosterPump': /\b(pompa|booster|pendorong|pumps?)/i,
  // Evaluasi 2026-10-06: dari "Instalasi air bersih untuk rumah baru 1 lantai" model menulis
  // `source: municipal`. Sumber air hanya dipercaya bila pengguna menyebut sumbernya.
  'water.source':
    /\b(toren|tandon|tangki|pompa|pdam|sumur|ledeng|air tanah|sumber|tanks?|rooftop|roof|ground|municipal|mains|city water|wells?|pumps?|source)/i,
  'water.installationType':
    /\b(air bersih|pembuangan|limbah|drainase|saluran|keduanya|clean water|potable|drinking water|supply|drainage|waste ?water|sewer|both)\b/i,
};

/**
 * Kebalikan dari pagar grounding: fakta yang **tersurat** di pesan tetapi dilewatkan model.
 * Model 7B mengembalikan `{}` untuk "lebih bagus PVC atau HDPE buat rumah 2 lantai?" — lalu
 * sistem bertanya "bangunannya berapa lantai?" kepada orang yang baru saja mengatakannya.
 * Hanya tiga hal yang bentuknya tidak bisa salah baca; nilainya dari teks, bukan tebakan,
 * dan hanya dipakai bila model tidak mengisinya.
 */
const OBVIOUS = {
  floors: (m: string) =>
    intAfter(/\b(\d{1,2})\s*-?\s*(?:lantai|lt|floors?|stor(?:e)?ys?|stories|levels?)\b/i, m),
  bathrooms: (m: string) =>
    intAfter(/\b(\d{1,2})\s*-?\s*(?:kamar mandi|km|toilet|bathrooms?|toilets?|restrooms?)\b/i, m),
  // Jumlah wastafel/dapur/titik air yang tersurat juga dibaca kode (diet panggilan model,
  // 2026-10-07): bila model dilewati, "4 wastafel, 1 dapur" tetap tercatat.
  basins: (m: string) =>
    intAfter(
      /\b(\d{1,3})\s*-?\s*(?:wastafel|washtafel|westafel|bak cuci|basins?|sinks?|washbasins?)\b/i,
      m,
    ),
  kitchens: (m: string) => intAfter(/\b(\d{1,2})\s*-?\s*(?:dapur|kitchens?|pantry)\b/i, m),
  installationType: (m: string): NonNullable<Extraction['water']>['installationType'] => {
    // Irigasi/pertanian BUKAN "drainage": ia di luar cakupan dan ditangani kebijakan guna
    // (policy/scope.ts `useCasePolicy`, isyarat dari pemahaman) sebelum ekstraksi.
    const drainage =
      /\b(drainase|pembuangan|limbah|saluran air kotor|drainage|waste ?water|sewer|sewage)\b/i.test(
        m,
      );
    const clean = /\b(air bersih|clean water|potable water|drinking water)\b/i.test(m);
    if (drainage && clean) return 'both';
    if (drainage) return 'drainage';
    if (clean) return 'clean_water';
    return undefined;
  },
  // Produksi 2026-10-07: "toren di atap" → model menulis `ground_tank`. Letak toren tersurat
  // di teks mengalahkan tebakan model; tanpa penanda letak, nilai model yang dipakai.
  source: (m: string): NonNullable<Extraction['water']>['source'] => {
    // Klitik "-nya" ikut: "torennya pindah ke bawah" (audit live 2026-10-08).
    const tank = /\b(toren|tandon|tangki|tanks?)(?:nya)?\b/i.test(m);
    if (
      tank &&
      // "toren atas" / "tandonnya atas" tanpa "di" (verifikasi live P16-14) juga letak di atas.
      /\b(atap|di atas|atas|lantai atas|atas rumah|rooftop|roof|tower|menara|overhead|elevated)\b/i.test(
        m,
      )
    )
      return 'rooftop_tank';
    if (tank && /\b(bawah|tanah|ground|di bawah|lantai dasar|underground|basement)\b/i.test(m))
      return 'ground_tank';
    if (/\b(pdam|ledeng|pam\b|municipal|mains|city water|town water)/i.test(m)) return 'municipal';
    return undefined;
  },
  // Cadangan bila model dilewati (diet 2026-10-07): sumur atau pompa yang disebut sebagai sumber,
  // bukan pompa pendorong ("pompa booster/pendorong/dorong" adalah `boosterPump`).
  pumpSource: (m: string): NonNullable<Extraction['water']>['source'] => {
    if (/\b(toren|tandon|tangki|tanks?)(?:nya)?\b/i.test(m)) return undefined;
    if (/\b(sumur|wells?|borehole|jet pump|pompa air|pompa sumur)\b/i.test(m)) return 'pump';
    if (/\b(?<!booster )(pompa|pumps?)\b(?!\s*(booster|pendorong|dorong))/i.test(m)) return 'pump';
    return undefined;
  },
  type: (m: string): NonNullable<Extraction['building']>['type'] => {
    if (/\b(kos|kost|kos-kosan|boarding house|dorm(?:itory)?|hostel)\b/i.test(m))
      return 'boarding_house';
    if (/\b(pabrik|industri|gudang|factory|plant|industrial|warehouse)\b/i.test(m))
      return 'industrial';
    // Tempat ibadah, sekolah, klinik: bangunan umum berpenghuni ramai — kelas komersial ringan
    // (produksi 2026-10-07: "masjid 2 lantai" tidak dikenali, lalu model kehabisan waktu).
    if (
      /\b(ruko|toko|kantor|kafe|cafe|resto|shophouse|shop|store|office|restaurant|hotel|clinic|school|masjid|mushol+a|musala|surau|gereja|vihara|pura|sekolah|madrasah|pesantren|puskesmas|klinik|mosque|church|temple)\b/i.test(
        m,
      )
    )
      return 'light_commercial';
    if (/\b(rumah|hunian|house|home|villa|residence|apartment)\b/i.test(m)) return 'residential';
    return undefined;
  },
};

/**
 * Pagar grounding untuk JUMLAH dan JENIS bangunan — ditambah setelah produksi 2026-10-06:
 * dari "mau tanya soal pipa" qwen2.5 7B menulis rumah 2 lantai, 3 kamar mandi, 2 wastafel,
 * 1 dapur (menyalin contoh di prompt), dan semuanya masuk state sebagai VERIFIED. Angka
 * hanya dipercaya bila angkanya sendiri ada di pesan (digit atau kata bilangan); `0` hanya
 * bila pesannya memuat peniadaan; jenis bangunan hanya bila kata bendanya ada.
 */
const NUMBER_WORDS: Readonly<Record<number, string>> = {
  1: 'satu|sebuah|one|a single',
  2: 'dua|two',
  3: 'tiga|three',
  4: 'empat|four',
  5: 'lima|five',
  6: 'enam|six',
  7: 'tujuh|seven',
  8: 'delapan|eight',
  9: 'sembilan|nine',
  10: 'sepuluh|ten',
  11: 'sebelas|eleven',
  12: 'dua belas|twelve',
};

/** Kata benda yang harus berdekatan dengan angkanya — "2 lantai", "lantai dua", "selantai", "2 floors". */
export const COUNT_NOUNS: Readonly<Record<string, string>> = {
  'building.floors': 'lantai|lt|tingkat|floors?|stor(?:e)?ys?|stories|levels?',
  'fixtures.bathrooms': 'kamar mandi|km|toilet|wc|bathrooms?|toilets?|restrooms?',
  'fixtures.basins': 'wastafel|washtafel|westafel|basins?|bak cuci|sinks?|washbasins?',
  'fixtures.kitchens': 'dapur|kitchens?|pantry',
  'fixtures.outletCount': 'titik|outlet|keran|kran|outlets?|taps?|faucets?|points?',
};

const NEGATION =
  'tidak ada|tanpa|nggak ada|gak ada|ga ada|tidak punya|belum ada|tidak pakai|no|without|none|zero';
// Paling banyak dua kata di antaranya ("3 buah kamar mandi"); tanda hubung dihitung spasi
// ("2-storey", "two-storey").
const GAP = '[\\s-]*(?:[a-z]+[\\s-]+){0,2}';

/**
 * Apakah pesan menyebut `n` buah `noun` — digit atau kata bilangan, sebelum atau sesudah kata
 * bendanya, atau awalan "se-" ("sekamar mandi"). `0` hanya bila ada peniadaan di dekat kata benda.
 * Angka yang jauh dari kata bendanya tidak dihitung: "rumah 2 lantai" bukan bukti untuk 2 wastafel.
 */
export function mentionsCount(message: string, n: number, noun: string): boolean {
  const text = message.toLowerCase();
  if (n === 0) return new RegExp(`\\b(?:${NEGATION})${GAP}(?:${noun})\\b`).test(text);
  const words = NUMBER_WORDS[n];
  const digits = `(?<![\\d.,])${n}(?![\\d.,]*\\d)`;
  const num = words === undefined ? digits : `(?:${digits}|\\b(?:${words})\\b)`;
  if (new RegExp(`${num}${GAP}(?:${noun})\\b`).test(text)) return true;
  if (new RegExp(`\\b(?:${noun})${GAP}${num}`).test(text)) return true;
  // "sekamar mandi" / "a bathroom" / "one bathroom" = 1.
  return (
    n === 1 &&
    (new RegExp(`\\bse(?:${noun})\\b`).test(text) ||
      new RegExp(`\\b(?:a|an)${GAP}(?:${noun})\\b`).test(text))
  );
}

const TYPE_MARKERS: Readonly<
  Record<NonNullable<NonNullable<Extraction['building']>['type']>, RegExp>
> = {
  residential:
    /\b(rumah|hunian|villa|vila|perumahan|apartemen|apartement|cluster|rumah tinggal|house|home|residence|apartment|flat)\b/i,
  boarding_house:
    /\b(kos|kost|kos-kosan|kosan|asrama|kontrakan|mess|boarding house|dorm(?:itory)?|hostel)\b/i,
  industrial: /\b(pabrik|industri|gudang|workshop|bengkel|factory|plant|industrial|warehouse)\b/i,
  light_commercial:
    /\b(ruko|toko|kantor|kafe|cafe|resto|restoran|hotel|klinik|sekolah|warung|shophouse|shop|store|office|restaurant|clinic|school|masjid|mushol+a|musala|surau|gereja|vihara|pura|madrasah|pesantren|puskesmas|mosque|church|temple)\b/i,
};

/** `0` bila pesan meniadakan kata benda itu ("tanpa dapur"); selain itu tidak ada tebakan. */
function negatedZero(message: string, noun: string): number | undefined {
  return mentionsCount(message, 0, noun) ? 0 : undefined;
}

function intAfter(pattern: RegExp, message: string): number | undefined {
  const match = pattern.exec(message);
  if (!match?.[1]) return undefined;
  const n = Number(match[1]);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function extractionToUpdates(extraction: Extraction, message = ''): FieldUpdate[] {
  const updates: FieldUpdate[] = [];
  const add = (path: FieldUpdate['path'], value: unknown): void => {
    if (value === undefined) return; // "tidak disebut di pesan ini"
    const marker = GROUNDING[path];
    if (marker && message !== '' && !marker.test(message)) return; // tidak pernah diucapkan
    const noun = COUNT_NOUNS[path];
    if (message !== '' && noun !== undefined && typeof value === 'number') {
      if (!mentionsCount(message, value, noun)) return; // angka yang tidak pernah diucapkan
    }
    if (message !== '' && path === 'building.type' && typeof value === 'string') {
      const typeMarker = TYPE_MARKERS[value as keyof typeof TYPE_MARKERS];
      if (typeMarker !== undefined && !typeMarker.test(message)) return; // bangunan tak disebut
    }
    updates.push({ path, value, source: 'user_stated' });
  };

  add('building.type', extraction.building?.type ?? OBVIOUS.type(message));
  // Angka model dipakai hanya bila tersurat di dekat kata bendanya; selain itu angka dari
  // teks (bila ada). "rumah 2 lantai" + model `floors: 3` → 2, bukan 3, bukan kosong.
  const counted = (path: string, model: number | undefined, obvious: number | undefined) =>
    model !== undefined && mentionsCount(message, model, COUNT_NOUNS[path] ?? '') ? model : obvious;

  add(
    'building.floors',
    counted('building.floors', extraction.building?.floors, OBVIOUS.floors(message)),
  );
  add('building.floorHeightM', extraction.building?.floorHeightM);
  if (extraction.building?.mainRunMeters !== undefined) {
    add('building.dimensions', { mainRunMeters: extraction.building.mainRunMeters });
  }

  add(
    'fixtures.bathrooms',
    counted('fixtures.bathrooms', extraction.fixtures?.bathrooms, OBVIOUS.bathrooms(message)),
  );
  // Peniadaan tersurat ("tidak ada dapur") yang dilewatkan model → 0 dari teks (produksi
  // 2026-10-07: model menghilangkan `kitchens` sama sekali, lalu sistem bertanya soal dapur).
  add(
    'fixtures.basins',
    counted(
      'fixtures.basins',
      extraction.fixtures?.basins,
      OBVIOUS.basins(message) ?? negatedZero(message, COUNT_NOUNS['fixtures.basins']!),
    ),
  );
  add(
    'fixtures.kitchens',
    counted(
      'fixtures.kitchens',
      extraction.fixtures?.kitchens,
      OBVIOUS.kitchens(message) ?? negatedZero(message, COUNT_NOUNS['fixtures.kitchens']!),
    ),
  );
  add('fixtures.outletCount', extraction.fixtures?.outletCount);

  // Toren disebut tanpa letaknya ("mau pasang 2 toren", produksi 2026-10-07): model menebak
  // `ground_tank` dan lolos. Letak toren adalah pertanyaan yang pantas ditanyakan, bukan ditebak —
  // nilai model dibuang, sumber air masuk klarifikasi.
  const tankWithoutLocation =
    /\b(toren|tandon|tangki|tanks?)(?:nya)?\b/i.test(message) &&
    OBVIOUS.source(message) === undefined;
  add(
    'water.source',
    OBVIOUS.source(message) ??
      (tankWithoutLocation ? undefined : extraction.water?.source) ??
      OBVIOUS.pumpSource(message),
  );
  add(
    'water.installationType',
    extraction.water?.installationType ?? OBVIOUS.installationType(message),
  );
  add('water.boosterPump', extraction.water?.boosterPump);

  return updates;
}
