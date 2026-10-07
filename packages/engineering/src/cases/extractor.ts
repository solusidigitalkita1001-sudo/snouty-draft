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

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
/** Satuan panjang sebagai kelompok tangkap — posisinya sama dengan "(m|meter)" yang lama. */
const M = String.raw`(m|meters?|metres?)`;

function num(raw: string): number {
  return Number(raw.replace(',', '.'));
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
  take(
    new RegExp(
      `(lebih rendah|lebih tinggi|naik|beda tinggi|ketinggian|elevasi|elevation difference|elevation gain|elevation|height difference|static head|lift|rise)\\s*(?:sekitar|kira-kira|sejauh|setinggi|of|about|approximately|around|roughly)?\\s*${NUM}\\s*${M}\\b`,
    ),
    (m) => {
      const before = text.slice(Math.max(0, m.index - 30), m.index);
      add('static_head', staticHead(num(m[2]!), !/lebih tinggi/.test(m[1]!), before), m[0], 'm');
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
      const pond = caseId === 'fish_pond';
      add(pond ? 'pond_length' : 'field_length', num(m[1]!), m[0], 'm');
      add(pond ? 'pond_width' : 'field_width', num(m[2]!), m[0], 'm');
      if (m[3] && pond) add('pond_depth', num(m[3]), m[0], 'm');
    },
  );
  if (caseId === 'fish_pond') {
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
  take(new RegExp(`${NUM}\\s*bar\\b`), (m) => add('required_pressure', num(m[1]!), m[0], 'bar'));

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
  take(/(\d+)\s*-?\s*(lantai|floors?|stor(?:eys?|ies|y))\b/, (m) =>
    add('building_floors', Number(m[1]), m[0], 'lantai'),
  );
  take(/(\d+)\s*(?:kamar mandi|bathrooms?)/, (m) => add('bathrooms', Number(m[1]), m[0], 'titik'));
  take(/(\d+)\s*(?:wastafel|basins?|sinks?)/, (m) => add('basins', Number(m[1]), m[0], 'titik'));
  take(/(\d+)\s*(?:dapur|kitchens?)/, (m) => add('kitchens', Number(m[1]), m[0], 'titik'));
  take(/(\d+)\s*(?:titik(?: air)?|outlets?|taps?|faucets?)\b/, (m) =>
    add('number_of_outlets', Number(m[1]), m[0], 'titik'),
  );
  take(
    /(\d+)\s*(unit|units|rumah|kk|kavling|sambungan|houses?|homes?|connections?|plots?)\b/,
    (m) => {
      add('number_of_connections', Number(m[1]), m[0], 'sambungan');
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
  else if (/\bembung\b|\bkolam\b|\bwaduk\b|\bdanau\b|\bpond\b|\blake\b/.test(whole))
    add('source_type', 'Embung / kolam', 'embung');
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

  const material =
    /pipa\s+(pvc|hdpe|ppr|galvanis|gip)\b|(pvc|hdpe|ppr|galvanis)\s+(?:yang )?(?:sudah|existing|terpasang|lama)|(pvc|hdpe|ppr|galvani[sz]ed)\s+pipes?\b|existing\s+(pvc|hdpe|ppr|galvani[sz]ed)\b/.exec(
      whole,
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

  return out;
}
