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
  'building.floorHeightM': /\b(tinggi|ketinggian|meter|\d\s*m\b)/i,
  'building.dimensions': /\b(meter|\d\s*m\b|panjang|jarak|jalur)/i,
  'fixtures.outletCount': /\b(titik|outlet|keran|kran)/i,
  'water.boosterPump': /\b(pompa|booster|pendorong)/i,
  // Evaluasi 2026-10-06: dari "Instalasi air bersih untuk rumah baru 1 lantai" model menulis
  // `source: municipal`. Sumber air hanya dipercaya bila pengguna menyebut sumbernya.
  'water.source': /\b(toren|tandon|tangki|pompa|pdam|sumur|ledeng|air tanah|sumber)/i,
  'water.installationType': /\b(air bersih|pembuangan|limbah|drainase|saluran|keduanya)\b/i,
};

/**
 * Kebalikan dari pagar grounding: fakta yang **tersurat** di pesan tetapi dilewatkan model.
 * Model 7B mengembalikan `{}` untuk "lebih bagus PVC atau HDPE buat rumah 2 lantai?" — lalu
 * sistem bertanya "bangunannya berapa lantai?" kepada orang yang baru saja mengatakannya.
 * Hanya tiga hal yang bentuknya tidak bisa salah baca; nilainya dari teks, bukan tebakan,
 * dan hanya dipakai bila model tidak mengisinya.
 */
const OBVIOUS = {
  floors: (m: string) => intAfter(/\b(\d{1,2})\s*(?:lantai|lt)\b/i, m),
  bathrooms: (m: string) => intAfter(/\b(\d{1,2})\s*(?:kamar mandi|km|toilet)\b/i, m),
  installationType: (m: string): NonNullable<Extraction['water']>['installationType'] => {
    // Irigasi/pertanian BUKAN "drainage": ia di luar cakupan dan ditangani kebijakan guna
    // (policy/scope.ts `useCasePolicy`) sebelum ekstraksi.
    const drainage = /\b(drainase|pembuangan|limbah|saluran air kotor)\b/i.test(m);
    const clean = /\bair bersih\b/i.test(m);
    if (drainage && clean) return 'both';
    if (drainage) return 'drainage';
    if (clean) return 'clean_water';
    return undefined;
  },
  // Produksi 2026-10-07: "toren di atap" → model menulis `ground_tank`. Letak toren tersurat
  // di teks mengalahkan tebakan model; tanpa penanda letak, nilai model yang dipakai.
  source: (m: string): NonNullable<Extraction['water']>['source'] => {
    const tank = /\b(toren|tandon|tangki)\b/i.test(m);
    if (tank && /\b(atap|di atas|lantai atas|atas rumah|rooftop|tower|menara)\b/i.test(m))
      return 'rooftop_tank';
    if (tank && /\b(bawah|tanah|ground|di bawah|lantai dasar)\b/i.test(m)) return 'ground_tank';
    if (/\b(pdam|ledeng|pam\b)/i.test(m)) return 'municipal';
    return undefined;
  },
  type: (m: string): NonNullable<Extraction['building']>['type'] => {
    if (/\b(kos|kost|kos-kosan)\b/i.test(m)) return 'boarding_house';
    if (/\b(pabrik|industri|gudang)\b/i.test(m)) return 'industrial';
    if (/\b(ruko|toko|kantor|kafe|cafe|resto)\b/i.test(m)) return 'light_commercial';
    if (/\b(rumah|hunian)\b/i.test(m)) return 'residential';
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
  1: 'satu|sebuah',
  2: 'dua',
  3: 'tiga',
  4: 'empat',
  5: 'lima',
  6: 'enam',
  7: 'tujuh',
  8: 'delapan',
  9: 'sembilan',
  10: 'sepuluh',
  11: 'sebelas',
  12: 'dua belas',
};

/** Kata benda yang harus berdekatan dengan angkanya — "2 lantai", "lantai dua", "selantai". */
const COUNT_NOUNS: Readonly<Record<string, string>> = {
  'building.floors': 'lantai|lt|tingkat',
  'fixtures.bathrooms': 'kamar mandi|km|toilet|wc',
  'fixtures.basins': 'wastafel|washtafel|westafel|basin|bak cuci',
  'fixtures.kitchens': 'dapur|kitchen|pantry',
  'fixtures.outletCount': 'titik|outlet|keran|kran',
};

const NEGATION = 'tidak ada|tanpa|nggak ada|gak ada|ga ada|tidak punya|belum ada|tidak pakai';
const GAP = '\\s*(?:[a-z]+\\s+){0,2}'; // paling banyak dua kata di antaranya: "3 buah kamar mandi"

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
  return n === 1 && new RegExp(`\\bse(?:${noun})\\b`).test(text);
}

const TYPE_MARKERS: Readonly<
  Record<NonNullable<NonNullable<Extraction['building']>['type']>, RegExp>
> = {
  residential:
    /\b(rumah|hunian|villa|vila|perumahan|apartemen|apartement|cluster|rumah tinggal)\b/i,
  boarding_house: /\b(kos|kost|kos-kosan|kosan|asrama|kontrakan|mess)\b/i,
  industrial: /\b(pabrik|industri|gudang|workshop|bengkel)\b/i,
  light_commercial: /\b(ruko|toko|kantor|kafe|cafe|resto|restoran|hotel|klinik|sekolah|warung)\b/i,
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
      negatedZero(message, COUNT_NOUNS['fixtures.basins']!),
    ),
  );
  add(
    'fixtures.kitchens',
    counted(
      'fixtures.kitchens',
      extraction.fixtures?.kitchens,
      negatedZero(message, COUNT_NOUNS['fixtures.kitchens']!),
    ),
  );
  add('fixtures.outletCount', extraction.fixtures?.outletCount);

  add('water.source', OBVIOUS.source(message) ?? extraction.water?.source);
  add(
    'water.installationType',
    extraction.water?.installationType ?? OBVIOUS.installationType(message),
  );
  add('water.boosterPump', extraction.water?.boosterPump);

  return updates;
}
