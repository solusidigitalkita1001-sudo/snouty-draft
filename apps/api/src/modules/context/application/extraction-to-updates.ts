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
import { PipeSize, type Dimensions, type WorkType } from '@snouty/shared-types';
import { extractTechnicalContext, WORK_TYPE_MODE, workTypeOf } from '@snouty/engineering';

/** Kosakata renovasi yang tersurat (satu parser dengan kasus teknis) → field rumah. */
const EXISTING_MATERIAL_FIELD: Readonly<Record<string, string>> = {
  PVC: 'pvc',
  'Galvanis / besi': 'galvanized',
  HDPE: 'hdpe',
  PPR: 'ppr',
};
/**
 * "mau tambah 2 titik air" / "add 2 more water points": titik air yang DITAMBAHKAN pada perluasan
 * (P25-06). Parser angka bersatuan (angka + "titik"), seperti pembaca jumlah lain di berkas ini.
 */
const ADDED_OUTLETS =
  /\b(?:tambah(?:kan)?|menambah|nambah|ditambah)\s+(\d{1,3})\s+titik\b|\badd(?:ing)?\s+(\d{1,3})\s+(?:more\s+)?(?:water\s+)?(?:points?|outlets?)\b/i;

function addedOutletsOf(message: string): number | undefined {
  const m = ADDED_OUTLETS.exec(message);
  const n = m ? Number(m[1] ?? m[2]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** "Renovasi" / "pipa lama" tanpa jenis pekerjaan yang tersurat — ditanya, bukan ditebak. */
const RENOVATION_WORD =
  /\brenov|\brehab|pipa lama|pipa (?:yang )?(?:sudah )?(?:ada|terpasang)|instalasi lama|instalasi (?:yang )?(?:sudah )?ada|existing (?:pipe|plumbing|installation)|\bold pipes?\b|re-?pip(?:e|ing)/i;

function obviousRenovation(message: string): {
  readonly workType?: WorkType;
  readonly existingMainSize?: string;
  readonly existingPipeMaterial?: string;
  readonly existingOutlets?: number;
  readonly replacementLengthM?: number;
} {
  const facts = Object.fromEntries(extractTechnicalContext(message).map((f) => [f.key, f.value]));
  const stated = workTypeOf(message);
  const workType: WorkType | undefined = stated
    ? WORK_TYPE_MODE[stated.value]
    : RENOVATION_WORD.test(message)
      ? 'renovation'
      : undefined;
  const size = facts['existing_pipe_size'];
  const material = facts['existing_pipe_material'];
  const outlets = facts['existing_outlets'];
  const length = facts['replacement_length'];
  return {
    ...(workType ? { workType } : {}),
    ...(typeof size === 'string' ? { existingMainSize: size } : {}),
    ...(typeof material === 'string' && EXISTING_MATERIAL_FIELD[material]
      ? { existingPipeMaterial: EXISTING_MATERIAL_FIELD[material]! }
      : {}),
    ...(typeof outlets === 'number' ? { existingOutlets: outlets } : {}),
    ...(typeof length === 'number' ? { replacementLengthM: length } : {}),
  };
}

/** `3/4 inch`, `1\"`, `110 mm` → label `PipeSize`; tidak terbaca → `undefined` (tidak disimpan). */
function canonicalSize(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const text = raw
    .replace(/\b(inch(?:es)?|inci)\b/i, '"')
    .replace(/\s+"/, '"')
    .trim();
  return PipeSize.parse(text)?.label;
}

/** Penanda kata yang harus ada di pesan sebelum field ini dipercaya. */
const GROUNDING: Readonly<Record<string, RegExp>> = {
  // Penanda Indonesia DAN Inggris (Fase 15, P15-03): pemahaman dua bahasa hidup di pola kode.
  'building.floorHeightM': /\b(tinggi|ketinggian|meter|metre|height|\d\s*m\b)/i,
  'building.dimensions': /\b(meter|metre|\d\s*m\b|panjang|jarak|jalur|length|distance|run)/i,
  'fixtures.outletCount': /\b(titik|outlet|keran|kran|taps?|faucets?|points?)/i,
  'water.boosterPump': /\b(pompa|booster|pendorong|pumps?)/i,
  // Penggantian pipa (P22-03) hanya dipercaya bila penggantiannya memang disebut.
  'water.replaceExisting': /\b(ganti|diganti|mengganti|renov|lama|existing|replac|re-?pip)/i,
  // Kedalaman sumur hanya dipercaya bila sumurnya memang disebut.
  'water.wellDepthM': /\b(sumur|wells?|muka air|water level)/i,
  // Renovasi (P23-03): jenis pekerjaan dan data pipa lama hanya bila pekerjaannya memang disebut.
  'water.workType':
    /\b(renov|rehab|ganti|diganti|mengganti|perluas|tambah|nambah|lama|existing|replac|extend|extension|expan|add(?:ing)?\b|bangun baru|new build)/i,
  'water.existingMainSize': /\b(inch|inci|"|mm|dim|diameter|ukuran|size)/i,
  'water.existingPipeMaterial': /\b(galvanis|galvani[sz]ed|besi|steel|iron|pvc|hdpe|ppr|gip)\b/i,
  'water.existingOutlets': /\b(sudah ada|sudah terpasang|yang ada|lama|existing|sekarang)/i,
  'water.replacementLengthM': /\b(ganti|diganti|mengganti|replac|segmen|segment|bocor|leak)/i,
  // Evaluasi 2026-10-06: dari "Instalasi air bersih untuk rumah baru 1 lantai" model menulis
  // `source: municipal`. Sumber air hanya dipercaya bila pengguna menyebut sumbernya.
  'water.source':
    /\b(toren|tandon|tangki|pompa|pdam|sumur|ledeng|air tanah|sumber|tanks?|rooftop|roof|ground|municipal|mains|city water|wells?|pumps?|source)/i,
  // Klitik "-nya" ikut ("pembuangannya"), sama dengan pembaca nilainya.
  'water.installationType':
    /\b(air bersih|pembuangan|limbah|drainase|saluran|keduanya|clean water|potable|drinking water|supply|drainage|waste ?water|sewer|both)(?:nya)?\b/i,
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
  bathrooms: (m: string) => countOf('kamar mandi|km|toilet|bathrooms?|toilets?|restrooms?', m),
  // Jumlah wastafel/dapur/titik air yang tersurat juga dibaca kode (diet panggilan model,
  // 2026-10-07): bila model dilewati, "4 wastafel, 1 dapur" tetap tercatat.
  basins: (m: string) =>
    countOf('wastafel|washtafel|westafel|bak cuci|basins?|sinks?|washbasins?', m, 3),
  /** Keran wudhu — field sendiri (tempat ibadah, 2026-10-12), bukan wastafel. */
  wudhuTaps: (m: string) => countOf(WUDHU, m, 3),
  wudhuAreas: (m: string) => countOf(WUDHU_AREA, m, 3),
  urinals: (m: string) => countOf(URINAL, m, 3),
  kitchens: (m: string) => countOf('dapur|kitchens?|pantry', m),
  /**
   * Tinggi tiap lantai ("tinggi lantai 4 m", "tinggi tiap lantai 3,8 meter", "floor height 4 m")
   * — parser nilai bersatuan seperti lantai dan ukuran: yang dibaca hanya angka bermeter yang
   * terikat ke frasa benda "tinggi … lantai" / "floor height". Nilai apa pun dikembalikan; pagar
   * 2–10 m ada di kelengkapan, supaya nilai di luar rentang ditanyakan balik, bukan dibuang (TC-H-02).
   * "Plafon" tidak dibaca: tinggi plafon bukan tinggi antar lantai.
   */
  floorHeight: (m: string): number | undefined => {
    const match =
      /\b(?:tinggi|ketinggian)\s+(?:tiap|per|setiap|masing-masing|antar)?\s*lantai(?:nya)?\s*(?:[:=]|adalah|sekitar|kira-kira|±)?\s*(\d+(?:[.,]\d+)?)\s*(?:m\b|meter|metre)/i.exec(
        m,
      ) ??
      /\b(?:floor(?:-to-floor)?|storey|story)\s+height\s*(?:of|is|=|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:m\b|meters?|metres?)/i.exec(
        m,
      );
    if (!match) return undefined;
    const value = Number(match[1]!.replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  },
  installationType: (m: string): NonNullable<Extraction['water']>['installationType'] => {
    // Irigasi/pertanian BUKAN "drainage": ia di luar cakupan dan ditangani kebijakan guna
    // (policy/scope.ts `useCasePolicy`, isyarat dari pemahaman) sebelum ekstraksi.
    // Klitik "-nya" ikut ("hitung pipa pembuangannya juga" dulu tidak terbaca — simulasi 2026-10-19).
    const drainage =
      /\b(drainase|pembuangan|limbah|saluran air kotor|drainage|waste ?water|sewer|sewage)(?:nya)?\b/i.test(
        m,
      );
    // Sumber air (PDAM, toren, sumur) hanya bermakna untuk air bersih: pembuangan yang disebut bersama
    // sumbernya berarti keduanya dihitung, bukan pembuangan saja.
    const clean =
      /\b(air bersih|clean water|potable water|drinking water)\b/i.test(m) ||
      OBVIOUS.source(m) !== undefined;
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
  /**
   * Ukuran bangunan dan tanah ("rumah 8 x 15", "10x8", "tanah 10x20 m", "luas bangunan 120 m2",
   * "LT 200 m2") — parser nilai bersatuan. Pasangan "N x M" pertama adalah bangunan, kecuali kata
   * benda terakhir sebelum angkanya (dalam klausa yang sama) tanah/lahan/kavling → ukuran tanah,
   * atau ruangan ("kamar mandi 2x3") → bukan ukuran rumah (review putaran 3, 3a).
   */
  plan: (m: string): Dimensions | undefined => {
    const decimal = (s: string) => Number(s.replace(',', '.'));
    const out: Record<string, number> = {};
    const sides = /(\d+(?:[.,]\d+)?)\s*(?:m\s*)?[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:m\b|meter|metre)?/gi;
    const owner =
      /\b(?:(tanah|lahan|kavling|kaveling|plot|land|lt)|(kamar|km|wc|toilet|dapur|ruang|ruangan|bathroom|kitchen|room)|(rumah|bangunan|denah|house|building))(?:nya)?\b/gi;
    let from = 0;
    for (const match of m.matchAll(sides)) {
      // Klausa sebelum angka: dari pasangan sebelumnya atau tanda baca terakhir.
      const before = m.slice(from, match.index);
      from = match.index + match[0].length;
      const clause = before.split(/[,;\n]|\.\s/).at(-1) ?? '';
      // "4 km 10x8": ruangan yang didahului angka adalah jumlah, bukan pemilik ukuran.
      const nouns = [...clause.matchAll(owner)].filter(
        (n) => n[2] === undefined || !/\d\s*$/.test(clause.slice(0, n.index)),
      );
      const last = nouns.at(-1);
      if (last?.[2] !== undefined) continue; // ukuran ruangan
      const land = last?.[1] !== undefined;
      const lengthM = decimal(match[1]!);
      const widthM = decimal(match[2]!);
      const max = land ? 1000 : 200;
      if (lengthM < 2 || widthM < 2 || lengthM > max || widthM > max) continue;
      const [l, w] = land ? ['landLengthM', 'landWidthM'] : ['lengthM', 'widthM'];
      if (out[l] === undefined) Object.assign(out, { [l]: lengthM, [w]: widthM });
    }
    const isLand = (noun: string) =>
      /^(?:lahan|lahannya|tanah|tanahnya|kavling|kaveling|plot|land|lt)$/i.test(noun);
    const area =
      /\b(luas|luasnya|area|lt|lb)\b\s*(tanah|tanahnya|lahan|bangunan|bangunannya|rumah|land|building)?[^\d\n]{0,25}(\d+(?:[.,]\d+)?)\s*(?:m2|m²|meter persegi|square met(?:er|re)s?|sqm)/gi;
    for (const match of m.matchAll(area)) {
      const areaM2 = decimal(match[3]!);
      if (areaM2 < 10 || areaM2 > 100_000) continue;
      const land = isLand(match[1]!) || isLand(match[2] ?? '');
      const key = land ? 'landAreaM2' : 'areaM2';
      // Luas bangunan hanya bila sisi bangunan tidak disebut — sisi lebih tepat.
      if (out[key] === undefined && (land || out['lengthM'] === undefined)) out[key] = areaM2;
    }
    return Object.keys(out).length > 0 ? (out as Dimensions) : undefined;
  },
  type: (m: string): NonNullable<Extraction['building']>['type'] => {
    if (/\b(kos|kost|kos-kosan|boarding house|dorm(?:itory)?|hostel)\b/i.test(m))
      return 'boarding_house';
    if (/\b(pabrik|industri|gudang|factory|plant|industrial|warehouse)\b/i.test(m))
      return 'industrial';
    // Masjid dan musala: kelompok hitung tempat ibadah (wudhu serentak, toilet umum).
    if (/\b(masjid|mesjid|mushol+a|musholla|musala|surau|langgar|mosque)\b/i.test(m))
      return 'place_of_worship';
    // Sekolah dan klinik: toilet umum tanpa wudhu (pemilik 2026-10-12).
    if (/\b(sekolah|madrasah|pesantren|klinik|puskesmas|school|clinic)\b/i.test(m))
      return 'public_building';
    if (
      /\b(ruko|toko|kantor|kafe|cafe|resto|shophouse|shop|store|office|restaurant|hotel|gereja|vihara|pura|church|temple)\b/i.test(
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
/**
 * Sebutan keran wudhu — kata benda alat, field sendiri (bukan wastafel) sejak kelompok tempat ibadah
 * (2026-10-12). Kamus kata benda, bukan pola pertanyaan pengguna.
 */
const WUDHU = 'keran wudhu|kran wudhu|keran wudu|kran wudu|ablution taps?|wudu taps?|wudhu taps?';
/** Tempat wudhu = satu deret keran dengan satu pembuangan (pemilik 2026-10-12). */
const WUDHU_AREA = 'tempat wudhu|tempat wudu|area wudhu|area wudu|ablution areas?';
const URINAL = 'urinoir|urinoar|urinal|urinals|peturasan';

export const COUNT_NOUNS: Readonly<Record<string, string>> = {
  'building.floors': 'lantai|lt|tingkat|floors?|stor(?:e)?ys?|stories|levels?',
  'fixtures.bathrooms': 'kamar mandi|km|toilet|wc|bathrooms?|toilets?|restrooms?',
  'fixtures.basins': 'wastafel|washtafel|westafel|basins?|bak cuci|sinks?|washbasins?',
  'fixtures.wudhuTaps': WUDHU,
  'fixtures.wudhuAreas': WUDHU_AREA,
  'fixtures.urinals': URINAL,
  'fixtures.kitchens': 'dapur|kitchens?|pantry',
  'fixtures.outletCount': 'titik|outlet|keran|kran|outlets?|taps?|faucets?|points?',
  'water.existingOutlets': 'titik|outlet|keran|kran|outlets?|taps?|faucets?|points?',
};

const NEGATION =
  'tidak ada|tanpa|nggak ada|gak ada|ga ada|tidak punya|belum ada|tidak pakai|no|without|none|zero';
// Paling banyak dua kata di antaranya ("3 buah kamar mandi"); tanda hubung dihitung spasi
// ("2-storey", "two-storey"). Titik dua dan sama dengan juga pemisah ("dapur: 1", 2026-10-09).
const GAP = '[\\s:=-]*(?:[a-z]+[\\s:=-]+){0,2}';

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
    /\b(ruko|toko|kantor|kafe|cafe|resto|restoran|hotel|warung|shophouse|shop|store|office|restaurant|gereja|vihara|pura|church|temple)\b/i,
  public_building: /\b(sekolah|madrasah|pesantren|klinik|puskesmas|school|clinic)\b/i,
  place_of_worship: /\b(masjid|mesjid|mushol+a|musholla|musala|surau|langgar|mosque)\b/i,
};

/** `0` bila pesan meniadakan kata benda itu ("tanpa dapur"); selain itu tidak ada tebakan. */
function negatedZero(message: string, noun: string): number | undefined {
  return mentionsCount(message, 0, noun) ? 0 : undefined;
}

/**
 * Jumlah benda yang tersurat, dua urutan: "2 kamar mandi" dan "kamar mandi 2" / "kamar mandinya 4"
 * (uji pemilik 2026-10-09: "ruko 2 lantai, kamar mandi 2" — kamar mandinya tidak tercatat, lalu
 * ditanya lagi). Angka yang diikuti ukuran atau "lantai" ("kamar mandi 2x3 meter", "kamar mandi
 * 2 lantai") bukan jumlah.
 */
function countOf(nouns: string, message: string, digits = 2): number | undefined {
  const before = intAfter(
    new RegExp(`\\b(\\d{1,${digits}})\\s*-?\\s*(?:${nouns})\\b`, 'i'),
    message,
  );
  if (before !== undefined) return before;
  return intAfter(
    new RegExp(
      `\\b(?:${nouns})(?:nya)?\\s*(?:ada|sebanyak|berjumlah|:|=)?\\s*(\\d{1,${digits}})(?!\\s*(?:x|×|m\\b|meter|cm|mm|lantai|lt\\b|[.,]\\d))`,
      'i',
    ),
    message,
  );
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
    // Lantai dan ukuran ≤ 0 tidak ada artinya: ditolak, field-nya tetap ditanyakan (review putaran 3).
    if (path === 'building.floors' && typeof value === 'number' && value < 1) return;
    if (path === 'water.wellDepthM' && typeof value === 'number' && value < 0) return;
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

  // Jenis yang tersurat di pesan menang atas tebakan model (model bisa memakai kelas lama, mis.
  // sekolah → komersial ringan, yang lalu ditolak penanda dan jenisnya hilang).
  add('building.type', OBVIOUS.type(message) ?? extraction.building?.type);
  // Angka model dipakai hanya bila tersurat di dekat kata bendanya; selain itu angka dari
  // teks (bila ada). "rumah 2 lantai" + model `floors: 3` → 2, bukan 3, bukan kosong.
  const counted = (path: string, model: number | undefined, obvious: number | undefined) =>
    model !== undefined && mentionsCount(message, model, COUNT_NOUNS[path] ?? '') ? model : obvious;

  add(
    'building.floors',
    counted('building.floors', extraction.building?.floors, OBVIOUS.floors(message)),
  );
  // Tinggi lantai tersurat dari teks lebih dulu — termasuk nilai di luar 2–10 m, yang skema model
  // buang diam-diam; kelengkapan menahannya dan menanyakannya balik (TC-H-02).
  add('building.floorHeightM', OBVIOUS.floorHeight(message) ?? extraction.building?.floorHeightM);
  // Ukuran rumah dari teks lebih dulu (nilai tersurat); panjang jalur dari model hanya bila
  // ukuran rumah tidak disebut. Keduanya disimpan bersama bila keduanya ada.
  const plan = OBVIOUS.plan(message);
  const run = extraction.building?.mainRunMeters;
  if (plan !== undefined) {
    updates.push({
      path: 'building.dimensions',
      value:
        run !== undefined && GROUNDING['building.dimensions']!.test(message)
          ? { ...plan, mainRunMeters: run }
          : plan,
      source: 'user_stated',
    });
  } else if (run !== undefined) {
    add('building.dimensions', { mainRunMeters: run });
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
  // Keran wudhu tercatat sendiri — dihitung serentak oleh kelompok tempat ibadah.
  add(
    'fixtures.wudhuTaps',
    OBVIOUS.wudhuTaps(message) ?? negatedZero(message, COUNT_NOUNS['fixtures.wudhuTaps']!),
  );
  add('fixtures.wudhuAreas', OBVIOUS.wudhuAreas(message));
  add(
    'fixtures.urinals',
    OBVIOUS.urinals(message) ?? negatedZero(message, COUNT_NOUNS['fixtures.urinals']!),
  );
  add(
    'fixtures.kitchens',
    counted(
      'fixtures.kitchens',
      extraction.fixtures?.kitchens,
      OBVIOUS.kitchens(message) ?? negatedZero(message, COUNT_NOUNS['fixtures.kitchens']!),
    ),
  );
  // "sudah ada 4 titik air" adalah titik air LAMA (P23-05): angka yang sama tidak boleh menjadi
  // jumlah titik air baru.
  const renovation = obviousRenovation(message);
  // "tambah 2 titik air" juga bukan jumlah titik air rumah: ia beban baru perluasan (P25-06).
  const added = addedOutletsOf(message);
  add(
    'fixtures.outletCount',
    (renovation.existingOutlets !== undefined &&
      extraction.fixtures?.outletCount === renovation.existingOutlets) ||
      (added !== undefined && extraction.fixtures?.outletCount === added)
      ? undefined
      : extraction.fixtures?.outletCount,
  );

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
  add('water.wellDepthM', extraction.water?.wellDepthM);
  add('water.replaceExisting', extraction.water?.replaceExisting);
  // Renovasi (P23-03): ukuran pipa lama dinormalkan ke label kanonik; label yang tidak terbaca
  // dibuang, bukan disimpan sebagai teks bebas.
  // Model yang melewatkannya tidak membuat renovasi hilang: kosakata yang tersurat dibaca kode
  // (pola OBVIOUS); jenis yang tersurat di kalimat menang atas tebakan model yang lebih samar.
  add(
    'water.workType',
    renovation.workType !== undefined && renovation.workType !== 'renovation'
      ? renovation.workType
      : (extraction.water?.workType ?? renovation.workType),
  );
  add(
    'water.existingMainSize',
    canonicalSize(extraction.water?.existingMainSize) ?? renovation.existingMainSize,
  );
  add(
    'water.existingPipeMaterial',
    extraction.water?.existingPipeMaterial ?? renovation.existingPipeMaterial,
  );
  add('water.existingOutlets', extraction.water?.existingOutlets ?? renovation.existingOutlets);
  add('water.addedOutlets', added);
  add(
    'water.replacementLengthM',
    extraction.water?.replacementLengthM ?? renovation.replacementLengthM,
  );

  return updates;
}
