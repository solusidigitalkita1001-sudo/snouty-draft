/**
 * TechnicalContextExtractor (brief §5 — fase 2). Fakta yang TERSURAT di pesan → parameter
 * universal, deterministik: "sungai 150 m, 4 m lebih rendah, 2 hektar sprinkler" menjadi
 * `source_type`, `route_length`, `static_head`, `total_area`, `irrigation_method`.
 *
 * Hanya bentuk yang tidak bisa salah baca. Yang ambigu ditinggalkan untuk ditanya — lebih
 * baik satu pertanyaan daripada satu angka salah yang menjalar ke sizing.
 */

import type { ParameterKey } from '../parameters/registry.js';
import type { CaseId } from './profiles.js';

export interface ExtractedParameter {
  readonly key: ParameterKey;
  readonly value: number | string | boolean;
  readonly unit?: string;
  /** Potongan teks yang menjadi dasarnya — untuk ditampilkan di "Data yang diketahui". */
  readonly evidence: string;
}

/**
 * Angka dengan pemisah ribuan Indonesia ("1.500", "2.500.000") atau desimal ("1,5", "2.5"). Kelompok
 * ribuan dicoba lebih dulu supaya "1.500" tidak terpotong jadi "1.500"→1,5 (audit PDAM 2026-10-16).
 */
const NUM = String.raw`(\d{1,3}(?:\.\d{3})+(?!\d)|\d+(?:[.,]\d+)?)`;
/** Satuan panjang sebagai kelompok tangkap — posisinya sama dengan "(m|meter)" yang lama. */
const M = String.raw`(m|meters?|metres?)`;

/**
 * Air tenang sebagai SUMBER: embung, waduk, danau — atau kolam yang disebut sebagai asal air ("dari
 * kolam", "sumber air kolam"). "kolam lele 10 kolam" adalah tujuan airnya, bukan sumbernya (audit
 * 2026-10-19: tercatat "sumber air embung / kolam" yang tidak pernah disebut).
 */
const STILL_WATER_SOURCE =
  /\bembung\b|\bwaduk\b|\bdanau\b|\blake\b|\b(?:dari|from|sumber(?: air)?(?:nya)?|source)\s+(?:an? |the )?(?:kolam|pond)\b/;

/**
 * "1.500" → 1500 (titik pemisah ribuan, kelompok tepat tiga digit); "1,5" dan "1.5" → 1,5. Angka
 * pengguna dipertahankan apa adanya — tidak ada pembulatan atau konversi diam-diam.
 */
export function num(raw: string): number {
  const text = raw.trim();
  if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, ''));
  return Number(text.replace(',', '.'));
}

export function extractTechnicalContext(
  message: string,
  caseId: CaseId | null = null,
): readonly ExtractedParameter[] {
  const out: ExtractedParameter[] = [];
  const seen = new Set<ParameterKey>();
  let text = ` ${message.toLowerCase()} `;
  // Isyarat kualitatif dibaca dari kalimat utuh: angka yang sudah "diambil" tidak boleh
  // menghilangkan kata di sekitarnya ("sumur bor 60 m" tetap berarti sumbernya sumur).
  const whole = text;

  const add = (
    key: ParameterKey,
    value: number | string | boolean,
    evidence: string,
    unit?: string,
  ) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, value, evidence: evidence.trim(), ...(unit ? { unit } : {}) });
  };
  /** Cocokkan, catat, lalu hapus dari teks supaya angka yang sama tidak terbaca dua kali. */
  const take = (re: RegExp, on: (m: RegExpExecArray) => void): void => {
    const m = re.exec(text);
    if (!m) return;
    on(m);
    text = text.replace(m[0], ' ');
  };

  // ── Beda tinggi (sebelum panjang: keduanya memakai "m") ──
  // Tinggi statis positif = tujuan lebih tinggi dari sumber (harus dinaikkan). Subjek kalimat
  // menentukan tandanya: "sungainya 4 m lebih rendah" dan "tandonnya 12 m lebih tinggi"
  // keduanya positif; "sumbernya 4 m lebih tinggi" negatif (gravitasi).
  const staticHead = (
    meters: number,
    lowerWord: boolean,
    before: string,
    fromTo = false,
  ): number => {
    const destinationSubject =
      (/tandon|toren|tujuan|lahan|rumah|reservoir|bak|gedung|atas|tank|destination|\bland\b|field|house|building/.test(
        before,
      ) ||
        fromTo) &&
      !/sumber|sungai|sumur|embung|kolam|mata air|pdam|river|source|\bwell\b|pond|spring/.test(
        before,
      );
    const sourceLower = destinationSubject ? !lowerWord : lowerWord;
    return sourceLower ? meters : -meters;
  };
  take(
    new RegExp(
      `${NUM}\\s*${M}\\s*(lebih rendah|di bawah|lebih tinggi|di atas|lower|below|downhill|higher|above|uphill)`,
    ),
    (m) => {
      const before = text.slice(Math.max(0, m.index - 30), m.index);
      const lowerWord = /rendah|bawah|lower|below|downhill/.test(m[3]!);
      // Kalimat Inggris "from <sumber> to <tujuan>, … 12 m higher": beda tinggi itu milik tujuan.
      // Urutan itu bisa lebih jauh dari 30 karakter, jadi dibaca dari seluruh awal kalimat.
      const fromTo = /\bfrom\b[^.]*\bto\b/.test(text.slice(0, m.index));
      add('static_head', staticHead(num(m[1]!), lowerWord, before, fromTo), m[0], 'm');
    },
  );
  // Klitik "-nya" dan kata sambung ("jadi", "menjadi", "sekitar") boleh di antara penanda dan angka:
  // "ubah beda tingginya jadi 20 meter" adalah beda tinggi, bukan panjang jalur (laporan pemilik
  // 2026-10-08: update teknis tidak berefek — angkanya jatuh ke route_length).
  take(
    new RegExp(
      `(lebih rendah|lebih tinggi|naik|beda tinggi|perbedaan tinggi|selisih tinggi|ketinggian|elevasi|bukit|hill|elevation difference|elevation gain|elevation|height difference|static head|lift|rise)(?:nya)?\\s*(?:(?:jadi|menjadi|diubah jadi|sekarang|sekitar|kira-kira|sejauh|setinggi|is|to|of|about|approximately|around|roughly)\\s*)*[:=]?\\s*${NUM}\\s*${M}\\b`,
    ),
    (m) => {
      const term = m[1]!;
      // Hanya "lebih rendah/lebih tinggi" yang membawa arah — subjek kalimat menentukan tandanya.
      // Penanda netral ("beda tinggi 15 m", "naik 15 m") berarti air dinaikkan sejauh itu: positif.
      if (term === 'lebih rendah' || term === 'lebih tinggi') {
        const before = text.slice(Math.max(0, m.index - 30), m.index);
        add('static_head', staticHead(num(m[2]!), term === 'lebih rendah', before), m[0], 'm');
      } else {
        add('static_head', num(m[2]!), m[0], 'm');
      }
    },
  );
  take(
    /(lebih rendah|lebih tinggi|lower|higher)\s+(?:dari|than)\s+(?:the\s+)?(lahan|rumah|tandon|tujuan|titik|field|land|house|tank|destination)/,
    (m) => {
      add('source_elevation', /rendah|lower/.test(m[1]!) ? 'Lebih rendah' : 'Lebih tinggi', m[0]);
    },
  );

  // ── Dimensi "4 x 4 meter" (kolam: panjang × lebar; lahan: panjang × lebar lahan) ──
  take(
    new RegExp(
      `${NUM}\\s*(?:x|×|by)\\s*${NUM}\\s*(?:(?:x|×|by)\\s*${NUM}\\s*)?(m|meters?|metres?)?\\b`,
    ),
    (m) => {
      // Gedung bertingkat: dua sisi adalah denah satu lantai → luas per lantai.
      if (caseId === 'multistorey_building_water') {
        add('floor_area', Math.round(num(m[1]!) * num(m[2]!) * 100) / 100, m[0], 'm²');
        return;
      }
      const pond = caseId === 'fish_pond';
      add(pond ? 'pond_length' : 'field_length', num(m[1]!), m[0], 'm');
      add(pond ? 'pond_width' : 'field_width', num(m[2]!), m[0], 'm');
      if (m[3] && pond) add('pond_depth', num(m[3]), m[0], 'm');
    },
  );
  if (caseId === 'fish_pond') {
    // Sisi kolam disebut satu per satu, bukan "4 x 3": "panjang 4 meter lebar 3 meter" (pemilik
    // 2026-10-26 — "panjang" jatuh ke panjang jalur dan "lebar" hilang tanpa bekas). Yang boleh
    // berdiri di antara penanda dan angka hanya kata "kolam", supaya "panjang jalur 4 m" tetap
    // panjang jalur.
    take(
      new RegExp(
        `(?:panjang(?:nya)?|length)\\s*(?:kolam(?:nya)?|pond)?\\s*[:=]?\\s*${NUM}\\s*${M}\\b`,
      ),
      (m) => add('pond_length', num(m[1]!), m[0], 'm'),
    );
    take(
      new RegExp(
        `(?:lebar(?:nya)?|width)\\s*(?:kolam(?:nya)?|pond)?\\s*[:=]?\\s*${NUM}\\s*${M}\\b`,
      ),
      (m) => add('pond_width', num(m[1]!), m[0], 'm'),
    );
    take(new RegExp(`${NUM}\\s*${M}\\s*wide\\b`), (m) => add('pond_width', num(m[1]!), m[0], 'm'));
    take(
      new RegExp(
        `(?:kedalaman|dalamnya|dalam|tinggi air|ketinggian air|depth|deep|water level)\\D{0,12}?${NUM}\\s*(m|meters?|metres?|cm)\\b`,
      ),
      (m) => {
        add('pond_depth', m[2] === 'cm' ? num(m[1]!) / 100 : num(m[1]!), m[0], 'm');
      },
    );
    // "1.2 m deep": angka mendahului kata kedalaman.
    take(new RegExp(`${NUM}\\s*(m|meters?|metres?|cm)\\s*(?:deep|depth)\\b`), (m) => {
      add('pond_depth', m[2] === 'cm' ? num(m[1]!) / 100 : num(m[1]!), m[0], 'm');
    });
    take(/(\d+)\s*(kolam|petak|tambak|bak|ponds?)\b/, (m) =>
      add('number_of_ponds', Number(m[1]), m[0], 'kolam'),
    );
    take(new RegExp(`${NUM}\\s*(?:jam|hours?|hrs?)\\b`), (m) =>
      add('fill_time_hours', num(m[1]!), m[0], 'jam'),
    );
  }

  // ── Kedalaman sumur (bukan untuk kolam: "dari sumur 15 m" di sana adalah jarak) ──
  if (caseId !== 'fish_pond') {
    take(
      new RegExp(
        `(?:sumur|kedalaman|dalamnya|well depth|borehole depth)\\D{0,20}?${NUM}\\s*${M}\\b`,
      ),
      (m) => {
        add('well_depth', num(m[1]!), m[0], 'm');
      },
    );
    // "a 60 m deep well": hanya bila memang membicarakan sumur, bukan galian atau parit.
    if (/\bwell\b|borehole/.test(whole))
      take(new RegExp(`${NUM}\\s*${M}\\s*deep\\b`), (m) => {
        add('well_depth', num(m[1]!), m[0], 'm');
      });
  }

  // ── Tinggi tandon tujuan ("tandon atas rumah setinggi 7 meter", "tinggi toren 7 m") ──
  // Dulu tidak dibaca sama sekali, dan tinggi angkat sumur dihitung tanpa tinggi tandonnya
  // (simulasi 2026-10-19: head 45,97 m untuk sumur 40 m ke tandon 7 m).
  take(
    new RegExp(
      `(?:(?:toren|tandon|tangki|tank|tower)\\w*[^.,\\d]{0,30}?(?:setinggi|tingginya|tinggi|ketinggian|elevasi|elevation|height(?: of)?|at)|(?:tinggi|ketinggian|elevasi)\\s+(?:toren|tandon|tangki|menara)\\w*)\\s*${NUM}\\s*${M}\\b`,
    ),
    (m) => {
      add('tank_elevation', num(m[1]!), m[0], 'm');
    },
  );

  // ── Timbunan / kedalaman tanam ──
  take(
    new RegExp(
      `(?:timbunan|ditanam|kedalaman tanam|tanam sedalam|di bawah permukaan|buried|burial depth|trench depth|cover depth)\\D{0,12}?${NUM}\\s*(m|meters?|metres?|cm)\\b`,
    ),
    (m) => {
      add('burial_depth', m[2] === 'cm' ? num(m[1]!) / 100 : num(m[1]!), m[0], 'm');
    },
  );

  // ── Lebar jalan ──
  take(
    new RegExp(
      `(?:lebar jalan|jalan selebar|jalan lebar|jalannya|road width|width of the road|road is|road of)\\D{0,12}?${NUM}\\s*${M}\\b`,
    ),
    (m) => {
      add('road_width', num(m[1]!), m[0], 'm');
    },
  );
  // "jalan desa lebar 6 meter", "jalan ... selebar 6 m": kata jalan dulu, lebar menyusul.
  take(new RegExp(`jalan\\D{0,30}?(?:lebar|selebar|lebarnya)\\D{0,6}?${NUM}\\s*${M}\\b`), (m) => {
    add('road_width', num(m[1]!), m[0], 'm');
  });
  // "a 6 m road", "a 6 m wide road": angka mendahului kata jalan.
  take(new RegExp(`${NUM}\\s*${M}\\s*(?:wide\\s*)?road\\b`), (m) => {
    add('road_width', num(m[1]!), m[0], 'm');
  });

  // ── Luas lantai gedung ──
  // Gedung bertingkat: "3000 m2" adalah luas PER LANTAI (m²), bukan luas lahan (ha); "100 x 30"
  // dibaca aturan dimensi di atas.
  if (caseId === 'multistorey_building_water') {
    take(new RegExp(`${NUM}\\s*(m2|m²|meter persegi|square meters?|square metres?|sqm)`), (m) => {
      add('floor_area', num(m[1]!), m[0], 'm²');
    });
  }

  // ── Luas ──
  take(new RegExp(`${NUM}\\s*(ha|hektar|hektare|hectares?)\\b`), (m) => {
    add(
      caseId === 'stormwater' || caseId === 'culvert' ? 'catchment_area' : 'total_area',
      num(m[1]!),
      m[0],
      'ha',
    );
  });
  take(new RegExp(`${NUM}\\s*(m2|m²|meter persegi|square meters?|square metres?|sqm)\\b`), (m) => {
    const ha = Math.round((num(m[1]!) / 10_000) * 10_000) / 10_000;
    add(
      caseId === 'stormwater' || caseId === 'culvert' ? 'catchment_area' : 'total_area',
      ha,
      m[0],
      'ha',
    );
  });

  // ── Debit ──
  take(
    new RegExp(
      `${NUM}\\s*(l/s|lps|liter/detik|liter per detik|l/detik|liters? per second|litres? per second|liters?/s|litres?/s|l/sec)`,
    ),
    (m) => {
      add('design_flow', num(m[1]!), m[0], 'l/s');
    },
  );
  take(
    new RegExp(
      `${NUM}\\s*(m3/jam|m³/jam|kubik/jam|m3/h|m³/h|cubic meters? per hour|cubic metres? per hour)`,
    ),
    (m) => {
      add('design_flow', Math.round((num(m[1]!) / 3.6) * 100) / 100, m[0], 'l/s');
    },
  );
  take(
    new RegExp(
      `${NUM}\\s*(l/menit|liter/menit|lpm|liter per menit|l/min|liters? per minute|litres? per minute)`,
    ),
    (m) => {
      add('design_flow', Math.round((num(m[1]!) / 60) * 100) / 100, m[0], 'l/s');
    },
  );

  // ── Hujan, kemiringan, tekanan ──
  take(new RegExp(`${NUM}\\s*(?:mm/jam|mm/h|mm/hr|mm per hour)`), (m) =>
    add('rainfall_intensity', num(m[1]!), m[0], 'mm/jam'),
  );
  take(
    new RegExp(`(?:kemiringan|slope|miring|gradient|incline)\\D{0,12}?${NUM}\\s*(?:%|percent)`),
    (m) => add('slope', num(m[1]!), m[0], '%'),
  );
  take(new RegExp(`${NUM}\\s*(?:%|percent)\\s*(?:slope|gradient|fall|incline)`), (m) =>
    add('slope', num(m[1]!), m[0], '%'),
  );
  // Tekanan SUMBER ("tekanan pdam 1,5 bar", "mains pressure 2 bar") diambil lebih dulu; "N bar" sisanya adalah
  // tekanan yang dibutuhkan di ujung (audit PDAM 2026-10-16).
  take(
    new RegExp(
      `(?:tekanan|pressure)\\s*(?:dari\\s*)?(?:pdam|sumber|sumbernya|meteran|jaringan pdam|mains|source|supply)\\D{0,12}?${NUM}\\s*bar\\b`,
    ),
    (m) => add('source_pressure', num(m[1]!), m[0], 'bar'),
  );
  take(new RegExp(`(?:pdam|mains|source)\\D{0,12}?${NUM}\\s*bar\\b`), (m) =>
    add('source_pressure', num(m[1]!), m[0], 'bar'),
  );
  take(new RegExp(`${NUM}\\s*bar\\b`), (m) => add('required_pressure', num(m[1]!), m[0], 'bar'));
  // Jumlah cabang jaringan ("bercabang 4", "4 cabang", "4 branches").
  take(/(?:bercabang|cabangnya|branches?:?)\s*(\d+)\b/, (m) =>
    add('number_of_branches', Number(m[1]), m[0], 'cabang'),
  );
  take(/(\d+)\s*(?:cabang|branches?)\b/, (m) =>
    add('number_of_branches', Number(m[1]), m[0], 'cabang'),
  );

  // ── Tinggi lantai ("tinggi lantai 4 m", "floor height 4 m") — bukan panjang jalur; menjadi tinggi
  // bangunan setelah jumlah lantainya diketahui (gedung bertingkat), bila tinggi bangunan tidak disebut.
  let floorHeightM: number | undefined;
  take(
    new RegExp(
      `(?:tinggi (?:antar )?lantai|tinggi per lantai|floor height|floor-to-floor|storey height)\\D{0,12}?${NUM}\\s*${M}\\b`,
    ),
    (m) => {
      floorHeightM = num(m[1]!);
    },
  );

  // ── Renovasi (P23-01): yang sudah terpasang dibaca lebih dulu supaya angkanya tidak jatuh ke
  // panjang jalur, diameter baru, atau jumlah titik/sambungan baru. ──
  const SIZE = String.raw`(\d+(?:[.,]\d+)?\s*mm|\d+\s*\d\/\d\s*(?:inch(?:es)?|inci|")|\d+\/\d\s*(?:inch(?:es)?|inci|")|\d+(?:[.,]\d+)?\s*(?:inch(?:es)?|inci|"))`;
  const sizeLabel = (raw: string): string => {
    const mm = /^(\d+(?:[.,]\d+)?)\s*mm$/i.exec(raw.trim());
    if (mm) return `${mm[1]!.replace(',', '.')} mm`;
    return `${raw
      .replace(/\s*(inch(?:es)?|inci|")\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim()}"`;
  };
  take(
    new RegExp(
      `(?:pipa|pipe|main|induk|utama)\\D{0,16}?(?:lama|eksisting|existing|yang (?:sudah )?(?:ada|terpasang)|sekarang|old)\\D{0,16}?${SIZE}`,
    ),
    (m) => add('existing_pipe_size', sizeLabel(m[1]!), m[0]),
  );
  take(new RegExp(`(?:existing|old)\\s+(?:\\w+\\s+){0,2}?(?:pipe|main)\\D{0,10}?${SIZE}`), (m) =>
    add('existing_pipe_size', sizeLabel(m[1]!), m[0]),
  );
  // 'existing 1" steel pipe': ukurannya mendahului kata pipanya.
  take(new RegExp(`(?:existing|old)\\s+${SIZE}\\s*(?:\\w+\\s+)?(?:pipe|main)\\b`), (m) =>
    add('existing_pipe_size', sizeLabel(m[1]!), m[0]),
  );
  take(
    new RegExp(
      `(?:diganti|ganti|mengganti|replac(?:e|ing))\\D{0,24}?(?:sepanjang|sekitar|about|of)?\\s*${NUM}\\s*${M}\\b`,
    ),
    (m) => add('replacement_length', num(m[1]!), m[0], 'm'),
  );
  take(
    new RegExp(
      `${NUM}\\s*${M}\\s*(?:yang )?(?:diganti|mau diganti|akan diganti|to be replaced|replaced|of pipe (?:is |to be )?replaced)`,
    ),
    (m) => add('replacement_length', num(m[1]!), m[0], 'm'),
  );
  take(
    /(?:sudah ada|sudah terpasang|yang (?:sudah )?ada|existing|sekarang ada)\D{0,14}?(\d+)\s*(?:titik(?: air)?|outlets?|taps?|kran|keran)/,
    (m) => add('existing_outlets', Number(m[1]), m[0], 'titik'),
  );
  take(
    /(\d+)\s*(?:titik(?: air)?|outlets?|taps?|kran|keran)\s*(?:yang )?(?:sudah ada|sudah terpasang|lama|existing|sekarang)/,
    (m) => add('existing_outlets', Number(m[1]), m[0], 'titik'),
  );
  take(
    new RegExp(
      String.raw`(?:sudah (?:melayani|ada|terpasang|dilayani)|yang (?:sudah )?ada|existing|already serv(?:es|ing))\D{0,14}?${NUM}\s*(?:sambungan|sr|unit|rumah|kk|connections?|houses?|homes?)\b`,
    ),
    (m) => add('existing_connections', num(m[1]!), m[0], 'sambungan'),
  );
  take(
    new RegExp(
      String.raw`${NUM}\s*(?:sambungan|sr|unit|rumah|kk|connections?|houses?|homes?)\s*(?:yang )?(?:sudah (?:ada|dilayani|terpasang)|lama|existing|already served)`,
    ),
    (m) => add('existing_connections', num(m[1]!), m[0], 'sambungan'),
  );

  // ── Panjang jalur (setelah elevasi/sumur/jalan diambil) ──
  take(new RegExp(`${NUM}\\s*(km|kilomet(?:er|re)s?)\\b`), (m) =>
    add('route_length', num(m[1]!) * 1000, m[0], 'm'),
  );
  take(
    new RegExp(
      `(?:jarak|jauh|sejauh|panjang|jalur|pipa|distance|length|route|pipeline)\\D{0,20}?${NUM}\\s*${M}\\b`,
    ),
    (m) => {
      add('route_length', num(m[1]!), m[0], 'm');
    },
  );
  // "150 m away", "300 m main line", "150 m from the river": angka mendahului penandanya.
  take(
    new RegExp(`${NUM}\\s*${M}\\s*(?:away|long|main\\s*line|pipeline|of pipe(?:line)?|from the)`),
    (m) => add('route_length', num(m[1]!), m[0], 'm'),
  );
  take(new RegExp(`${NUM}\\s*${M}\\b(?!\\s*(?:persegi|2|²))`), (m) =>
    add('route_length', num(m[1]!), m[0], 'm'),
  );

  // ── Bangunan ──
  take(/(\d+)\s*-?\s*(lantai|floors?|stor(?:eys?|ies|y))\b/, (m) => {
    add('building_floors', Number(m[1]), m[0], 'lantai');
    if (floorHeightM !== undefined) {
      add('building_height', Number(m[1]) * floorHeightM, `${m[0]} × ${floorHeightM} m`, 'm');
    }
  });
  take(
    new RegExp(
      String.raw`${NUM}\s*(?:orang|jiwa|penduduk|penghuni|karyawan|pegawai|pekerja|people|persons?|occupants?|employees?|staff|inhabitants?)\b`,
    ),
    (m) => add('number_of_occupants', num(m[1]!), m[0], 'orang'),
  );
  // Titik air PER LANTAI ("4 toilet per lantai", "tiap lantai 6 kamar mandi") — diambil sebelum
  // jumlah total supaya angka yang sama tidak terbaca dua kali.
  const PER_FLOOR = String.raw`(?:per|tiap|setiap|each|per\s+)\s*(?:lantai|floor)`;
  const TOILET = String.raw`(?:kamar mandi|toilet|wc|bathrooms?|toilets?)`;
  const BASIN = String.raw`(?:wastafel|basins?|sinks?)`;
  take(new RegExp(String.raw`(\d+)\s*${TOILET}\s*${PER_FLOOR}`), (m) =>
    add('bathrooms_per_floor', Number(m[1]), m[0], 'titik'),
  );
  take(new RegExp(String.raw`${PER_FLOOR}\D{0,12}?(\d+)\s*${TOILET}`), (m) =>
    add('bathrooms_per_floor', Number(m[1]), m[0], 'titik'),
  );
  take(new RegExp(String.raw`(\d+)\s*${BASIN}\s*${PER_FLOOR}`), (m) =>
    add('basins_per_floor', Number(m[1]), m[0], 'titik'),
  );
  take(new RegExp(String.raw`${PER_FLOOR}\D{0,12}?(\d+)\s*${BASIN}`), (m) =>
    add('basins_per_floor', Number(m[1]), m[0], 'titik'),
  );
  take(/(\d+)\s*(?:kamar mandi|bathrooms?)/, (m) => add('bathrooms', Number(m[1]), m[0], 'titik'));
  take(/(\d+)\s*(?:wastafel|basins?|sinks?)/, (m) => add('basins', Number(m[1]), m[0], 'titik'));
  take(/(\d+)\s*(?:dapur|kitchens?)/, (m) => add('kitchens', Number(m[1]), m[0], 'titik'));
  take(/(\d+)\s*(?:titik(?: air)?|outlets?|taps?|faucets?)\b/, (m) =>
    add('number_of_outlets', Number(m[1]), m[0], 'titik'),
  );
  take(
    new RegExp(
      String.raw`${NUM}\s*(unit|units|rumah|kk|kavling|sambungan|sr|houses?|homes?|connections?|plots?)\b`,
    ),
    (m) => {
      add('number_of_connections', num(m[1]!), m[0], 'sambungan');
    },
  );

  // ── Diameter nominal ──
  take(/(\d+(?:[.,]\d+)?|\d+\s*\d\/\d)\s*(inch(?:es)?|inci|")/, (m) =>
    add('nominal_diameter', `${m[1]!.replace(/\s+/g, ' ')}"`, m[0]),
  );

  // ── Kualitatif ──
  if (
    /\bsungai\b|\bkali\b|\bsaluran irigasi\b|\bparit\b|\briver\b|\bstream\b|\bcreek\b|\bcanal\b/.test(
      whole,
    )
  )
    add('source_type', 'Sungai / saluran', 'sungai');
  else if (/sumur|\bwell\b(?! as)|borehole/.test(whole)) add('source_type', 'Sumur', 'sumur');
  else if (STILL_WATER_SOURCE.test(whole))
    add('source_type', 'Embung / kolam', STILL_WATER_SOURCE.exec(whole)![0]);
  else if (/\bpdam\b|municipal|mains water|city water/.test(whole))
    add('source_type', 'PDAM', 'pdam');
  else if (
    /toren (di )?atap|toren atas|tandon atas|roof ?top tank|roof tank|overhead tank/.test(whole)
  )
    add('source_type', 'Toren atap', 'toren atap');
  else if (/toren bawah|tandon bawah|ground tank|underground tank|\bcistern\b/.test(whole))
    add('source_type', 'Toren bawah', 'toren bawah');
  else if (/\breservoir\b/.test(whole)) add('source_type', 'Reservoir', 'reservoir');

  if (/\btetes\b|\bdrip\b|\btrickle\b/.test(whole)) add('irrigation_method', 'Tetes', 'tetes');
  else if (/sprinkler|springkel|curah/.test(whole))
    add('irrigation_method', 'Sprinkler', 'sprinkler');
  else if (/genang|gravitasi|flood irrigation|\bgravity\b/.test(whole))
    add('irrigation_method', 'Genangan / gravitasi', 'genangan');

  if (/air hujan|\bhujan\b|rain ?water|storm ?water|\brain\b|runoff/.test(whole))
    add('fluid_type', 'Air hujan', 'air hujan');
  else if (/\blimbah\b|air kotor|pembuangan|wastewater|sewage|\bsewer\b|\bseptic\b/.test(whole))
    add('fluid_type', 'Air limbah', 'air limbah');
  else if (/\bsawah\b|\birigasi\b|\bkebun\b|irrigation|paddy|rice field|\bfarm|orchard/.test(whole))
    add('fluid_type', 'Air irigasi', 'irigasi');
  else if (/air bersih|clean water|drinking water|potable/.test(whole))
    add('fluid_type', 'Air bersih', 'air bersih');

  if (
    /pakai pompa|dengan pompa|dipompa|memompa|pompanya|pompa \d/.test(whole) ||
    // Negasi English dicek lewat lookbehind: "without a pump" bukan permintaan pompa.
    /(?<!without |no |not )(?:with (?:a )?pump|using (?:a )?pump|pumped|pumping|needs? (?:a )?pump|by pump)/.test(
      whole,
    )
  )
    add('pump_required', true, 'pompa');
  else if (
    /tanpa pompa|gravitasi saja|nggak pakai pompa|tidak pakai pompa|without (?:a )?pump|no pump|gravity only|gravity[- ]fed/.test(
      whole,
    )
  )
    add('pump_required', false, 'tanpa pompa');

  if (/\bdatar\b|\bflat\b|level ground/.test(whole)) add('terrain', 'Datar', 'datar');
  else if (
    /\bmiring\b|\bberbukit\b|\bmenanjak\b|\bsloping\b|\bsloped\b|\bhilly\b|\bsteep\b/.test(whole)
  )
    add('terrain', 'Miring', 'miring');
  else if (/bergelombang|naik turun|undulating|rolling terrain|up and down/.test(whole))
    add('terrain', 'Bergelombang', 'bergelombang');

  // Bahan pipa LAMA (renovasi, P23-01): "pipa lama galvanis", "pipa besi yang ada", "existing
  // galvanized pipe" — bukan preferensi bahan untuk pipa baru.
  const existingMaterial =
    /(?:pipa|pipe)\s+(?:\w+\s+)?(?:lama|eksisting|existing|old|yang (?:sudah )?(?:ada|terpasang))[^,.;]{0,24}?\b(pvc|hdpe|ppr|galvanis|galvani[sz]ed|gip|besi|steel|iron)\b|(pvc|hdpe|ppr|galvanis|galvani[sz]ed|gip|besi|steel|iron)\s+(?:yang )?(?:sudah (?:ada|terpasang)|existing|terpasang|lama)\b|(?:existing|old)[^,.;]{0,14}?\b(pvc|hdpe|ppr|galvani[sz]ed|steel|iron)\s+(?:pipes?|main)\b|pipa\s+(besi|gip)\b/.exec(
      whole,
    );
  if (existingMaterial) {
    const name = (existingMaterial[1] ??
      existingMaterial[2] ??
      existingMaterial[3] ??
      existingMaterial[4])!;
    const label =
      name === 'pvc'
        ? 'PVC'
        : name === 'hdpe'
          ? 'HDPE'
          : name === 'ppr'
            ? 'PPR'
            : 'Galvanis / besi';
    add('existing_pipe_material', label, existingMaterial[0]);
  }
  const forNewPipe = existingMaterial ? whole.replace(existingMaterial[0], ' ') : whole;
  const material =
    /pipa\s+(pvc|hdpe|ppr|galvanis|gip)\b|(pvc|hdpe|ppr|galvanis)\s+(?:yang )?(?:sudah|existing|terpasang|lama)|(pvc|hdpe|ppr|galvani[sz]ed)\s+pipes?\b|existing\s+(pvc|hdpe|ppr|galvani[sz]ed)\b/.exec(
      forNewPipe,
    );
  if (material) {
    const name = (material[1] ?? material[2] ?? material[3] ?? material[4])!;
    const label =
      name === 'pvc'
        ? 'PVC (uPVC)'
        : name === 'gip' || name.startsWith('galvani')
          ? 'Galvanis'
          : name.toUpperCase();
    add('material', label, material[0]);
  }

  if (
    /\btruk\b|kendaraan berat|\bberat\b|\btrucks?\b|heavy (?:vehicles?|traffic|loads?)/.test(whole)
  )
    add('traffic_load', 'Truk / berat', 'truk');
  else if (/\bmobil\b|\bcars?\b|light vehicles?/.test(whole)) add('traffic_load', 'Mobil', 'mobil');

  // ── Jenis pekerjaan (P23-01): nilai enum dari kosakata, hanya bila modenya tersurat. "Renovasi"
  // saja tidak cukup — itu isyarat (`renovationCue`) yang membuat jenis pekerjaannya ditanya. ──
  const workType = workTypeOf(whole);
  if (workType) add('work_type', workType.value, workType.evidence);

  return out;
}

const EXTEND = /perluas|perluasan|\bextend(?:ing|ed)?\b|\bextension\b|\bexpan(?:d|sion)\b/;
/** "Tambah …" hanya berarti perluasan bila ada instalasi yang sudah ada di kalimatnya — "tambah satu kamar mandi" saja adalah perubahan kebutuhan. */
const EXTEND_VERB = /\btambah(?:an)?\b|\bnambah\b|menambah|ditambah|\badd(?:ing)?\b/;
const EXISTING_CONTEXT =
  /\brenov|\brehab|existing|\blama\b|sudah ada|sudah terpasang|yang ada|sudah melayani|already serv|\bold\b/;
const PARTIAL =
  /ganti sebagian|sebagian(?: pipa)?(?: yang)? diganti|\bsegmen\b|\bsegment\b|partial(?:ly)?\b|replace (?:a |the )?(?:section|segment|part|stretch)|(?:pipa|pipe)\D{0,20}?(?:bocor|rusak|pecah|leak(?:s|ing)?|burst|broken|cracked)|(?:bocor|rusak|pecah|leak(?:s|ing)?|burst|broken)\D{0,20}?(?:pipa|pipe)/;
const REPLACE_ALL =
  /ganti (?:semua|seluruh|total|semuanya)|(?:semua|seluruh|semuanya|total)\D{0,12}?(?:pipa|pipe)\D{0,12}?(?:diganti|ganti)|rehab(?:ilitasi)?\b|replace (?:all|every|the whole|the entire)|re-?pip(?:e|ing)\b|renovasi total|bongkar (?:semua|total)|ganti (?:instalasi|pipa)nya semua|ganti pipa lama|ganti pipanya/;

/**
 * Jenis pekerjaan yang TERSURAT di kalimat (nilai protokol `work_type`), atau `null`. Diekspor
 * supaya alur rumah membaca kosakata yang sama (P23-05) — satu parser, bukan dua daftar.
 */
export function workTypeOf(
  message: string,
): { readonly value: string; readonly evidence: string } | null {
  const whole = ` ${message.toLowerCase()} `;
  const partial = PARTIAL.exec(whole);
  if (partial) return { value: 'Ganti sebagian', evidence: partial[0] };
  const extend = EXTEND.exec(whole);
  if (extend) return { value: 'Perluasan', evidence: extend[0] };
  const verb = EXTEND_VERB.exec(whole);
  if (verb && EXISTING_CONTEXT.test(whole)) return { value: 'Perluasan', evidence: verb[0] };
  const all = REPLACE_ALL.exec(whole);
  if (all) return { value: 'Ganti semua pipa', evidence: all[0] };
  return null;
}

/**
 * Pesan menyebut pekerjaan di instalasi yang sudah ada ("renovasi", "pipa lama", "existing")
 * tanpa jenisnya tersurat — jenis pekerjaannya ditanya, bukan ditebak.
 */
export function renovationCue(message: string): boolean {
  const whole = ` ${message.toLowerCase()} `;
  return (
    /\brenov|\brehab|pipa lama|pipa (?:yang )?(?:sudah )?(?:ada|terpasang)|instalasi lama|instalasi (?:yang )?(?:sudah )?ada|yang sudah ada|existing|\bold pipes?\b|\bupgrade\b|\bganti\b|diganti|mengganti|\breplac/.test(
      whole,
    ) || workTypeOf(whole) !== null
  );
}
