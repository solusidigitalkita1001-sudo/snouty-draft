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
  const staticHead = (meters: number, lowerWord: boolean, before: string): number => {
    const destinationSubject =
      /tandon|toren|tujuan|lahan|rumah|reservoir|bak|gedung|atas/.test(before) &&
      !/sumber|sungai|sumur|embung|kolam|mata air|pdam/.test(before);
    const sourceLower = destinationSubject ? !lowerWord : lowerWord;
    return sourceLower ? meters : -meters;
  };
  take(new RegExp(`${NUM}\\s*(m|meter)\\s*(lebih rendah|di bawah|lebih tinggi|di atas)`), (m) => {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    add('static_head', staticHead(num(m[1]!), /rendah|bawah/.test(m[3]!), before), m[0], 'm');
  });
  take(
    new RegExp(
      `(lebih rendah|lebih tinggi|naik|beda tinggi|ketinggian|elevasi)\\s*(?:sekitar|kira-kira|sejauh|setinggi)?\\s*${NUM}\\s*(m|meter)\\b`,
    ),
    (m) => {
      const before = text.slice(Math.max(0, m.index - 30), m.index);
      add('static_head', staticHead(num(m[2]!), !/lebih tinggi/.test(m[1]!), before), m[0], 'm');
    },
  );
  take(/(lebih rendah|lebih tinggi)\s+dari\s+(lahan|rumah|tandon|tujuan|titik)/, (m) => {
    add('source_elevation', /rendah/.test(m[1]!) ? 'Lebih rendah' : 'Lebih tinggi', m[0]);
  });

  // ── Dimensi "4 x 4 meter" (kolam: panjang × lebar; lahan: panjang × lebar lahan) ──
  take(new RegExp(`${NUM}\\s*[x×]\\s*${NUM}\\s*(?:[x×]\\s*${NUM}\\s*)?(m|meter)?\\b`), (m) => {
    const pond = caseId === 'fish_pond';
    add(pond ? 'pond_length' : 'field_length', num(m[1]!), m[0], 'm');
    add(pond ? 'pond_width' : 'field_width', num(m[2]!), m[0], 'm');
    if (m[3] && pond) add('pond_depth', num(m[3]), m[0], 'm');
  });
  if (caseId === 'fish_pond') {
    take(
      new RegExp(
        `(?:kedalaman|dalamnya|dalam|tinggi air|ketinggian air)\\D{0,12}?${NUM}\\s*(m|meter|cm)\\b`,
      ),
      (m) => {
        add('pond_depth', m[2] === 'cm' ? num(m[1]!) / 100 : num(m[1]!), m[0], 'm');
      },
    );
    take(/(\d+)\s*(kolam|petak|tambak|bak)\b/, (m) =>
      add('number_of_ponds', Number(m[1]), m[0], 'kolam'),
    );
    take(new RegExp(`${NUM}\\s*jam\\b`), (m) => add('fill_time_hours', num(m[1]!), m[0], 'jam'));
  }

  // ── Kedalaman sumur (bukan untuk kolam: "dari sumur 15 m" di sana adalah jarak) ──
  if (caseId !== 'fish_pond')
    take(new RegExp(`(?:sumur|kedalaman|dalamnya)\\D{0,20}?${NUM}\\s*(m|meter)\\b`), (m) => {
      add('well_depth', num(m[1]!), m[0], 'm');
    });

  // ── Timbunan / kedalaman tanam ──
  take(
    new RegExp(
      `(?:timbunan|ditanam|kedalaman tanam|tanam sedalam|di bawah permukaan)\\D{0,12}?${NUM}\\s*(m|meter|cm)\\b`,
    ),
    (m) => {
      add('burial_depth', m[2] === 'cm' ? num(m[1]!) / 100 : num(m[1]!), m[0], 'm');
    },
  );

  // ── Lebar jalan ──
  take(
    new RegExp(
      `(?:lebar jalan|jalan selebar|jalan lebar|jalannya)\\D{0,12}?${NUM}\\s*(m|meter)\\b`,
    ),
    (m) => {
      add('road_width', num(m[1]!), m[0], 'm');
    },
  );

  // ── Luas ──
  take(new RegExp(`${NUM}\\s*(ha|hektar|hektare)\\b`), (m) => {
    add(
      caseId === 'stormwater' || caseId === 'culvert' ? 'catchment_area' : 'total_area',
      num(m[1]!),
      m[0],
      'ha',
    );
  });
  take(new RegExp(`${NUM}\\s*(m2|m²|meter persegi)\\b`), (m) => {
    const ha = Math.round((num(m[1]!) / 10_000) * 10_000) / 10_000;
    add(
      caseId === 'stormwater' || caseId === 'culvert' ? 'catchment_area' : 'total_area',
      ha,
      m[0],
      'ha',
    );
  });

  // ── Debit ──
  take(new RegExp(`${NUM}\\s*(l/s|lps|liter/detik|liter per detik|l/detik)`), (m) => {
    add('design_flow', num(m[1]!), m[0], 'l/s');
  });
  take(new RegExp(`${NUM}\\s*(m3/jam|m³/jam|kubik/jam|m3/h)`), (m) => {
    add('design_flow', Math.round((num(m[1]!) / 3.6) * 100) / 100, m[0], 'l/s');
  });
  take(new RegExp(`${NUM}\\s*(l/menit|liter/menit|lpm|liter per menit)`), (m) => {
    add('design_flow', Math.round((num(m[1]!) / 60) * 100) / 100, m[0], 'l/s');
  });

  // ── Hujan, kemiringan, tekanan ──
  take(new RegExp(`${NUM}\\s*mm/jam`), (m) =>
    add('rainfall_intensity', num(m[1]!), m[0], 'mm/jam'),
  );
  take(new RegExp(`(?:kemiringan|slope|miring)\\D{0,12}?${NUM}\\s*%`), (m) =>
    add('slope', num(m[1]!), m[0], '%'),
  );
  take(new RegExp(`${NUM}\\s*bar\\b`), (m) => add('required_pressure', num(m[1]!), m[0], 'bar'));

  // ── Panjang jalur (setelah elevasi/sumur/jalan diambil) ──
  take(new RegExp(`${NUM}\\s*(km|kilometer)\\b`), (m) =>
    add('route_length', num(m[1]!) * 1000, m[0], 'm'),
  );
  take(
    new RegExp(`(?:jarak|jauh|sejauh|panjang|jalur|pipa)\\D{0,20}?${NUM}\\s*(m|meter)\\b`),
    (m) => {
      add('route_length', num(m[1]!), m[0], 'm');
    },
  );
  take(new RegExp(`${NUM}\\s*(m|meter)\\b(?!\\s*(?:persegi|2|²))`), (m) =>
    add('route_length', num(m[1]!), m[0], 'm'),
  );

  // ── Bangunan ──
  take(/(\d+)\s*lantai\b/, (m) => add('building_floors', Number(m[1]), m[0], 'lantai'));
  take(/(\d+)\s*kamar mandi/, (m) => add('bathrooms', Number(m[1]), m[0], 'titik'));
  take(/(\d+)\s*wastafel/, (m) => add('basins', Number(m[1]), m[0], 'titik'));
  take(/(\d+)\s*dapur/, (m) => add('kitchens', Number(m[1]), m[0], 'titik'));
  take(/(\d+)\s*titik( air)?\b/, (m) => add('number_of_outlets', Number(m[1]), m[0], 'titik'));
  take(/(\d+)\s*(unit|rumah|kk|kavling|sambungan)\b/, (m) => {
    add('number_of_connections', Number(m[1]), m[0], 'sambungan');
  });

  // ── Diameter nominal ──
  take(/(\d+(?:[.,]\d+)?|\d+\s*\d\/\d)\s*(inch|inci|")/, (m) =>
    add('nominal_diameter', `${m[1]!.replace(/\s+/g, ' ')}"`, m[0]),
  );

  // ── Kualitatif ──
  if (/\bsungai\b|\bkali\b|\bsaluran irigasi\b|\bparit\b/.test(whole))
    add('source_type', 'Sungai / saluran', 'sungai');
  else if (/sumur/.test(whole)) add('source_type', 'Sumur', 'sumur');
  else if (/\bembung\b|\bkolam\b|\bwaduk\b|\bdanau\b/.test(whole))
    add('source_type', 'Embung / kolam', 'embung');
  else if (/\bpdam\b/.test(whole)) add('source_type', 'PDAM', 'pdam');
  else if (/toren (di )?atap|toren atas|tandon atas/.test(whole))
    add('source_type', 'Toren atap', 'toren atap');
  else if (/toren bawah|tandon bawah|ground tank/.test(whole))
    add('source_type', 'Toren bawah', 'toren bawah');
  else if (/\breservoir\b/.test(whole)) add('source_type', 'Reservoir', 'reservoir');

  if (/\btetes\b|\bdrip\b/.test(whole)) add('irrigation_method', 'Tetes', 'tetes');
  else if (/sprinkler|springkel|curah/.test(whole))
    add('irrigation_method', 'Sprinkler', 'sprinkler');
  else if (/genang|gravitasi/.test(whole))
    add('irrigation_method', 'Genangan / gravitasi', 'genangan');

  if (/air hujan|\bhujan\b/.test(whole)) add('fluid_type', 'Air hujan', 'air hujan');
  else if (/\blimbah\b|air kotor|pembuangan/.test(whole))
    add('fluid_type', 'Air limbah', 'air limbah');
  else if (/\bsawah\b|\birigasi\b|\bkebun\b/.test(whole))
    add('fluid_type', 'Air irigasi', 'irigasi');
  else if (/air bersih/.test(whole)) add('fluid_type', 'Air bersih', 'air bersih');

  if (/pakai pompa|dengan pompa|dipompa|memompa|pompanya|pompa \d/.test(whole))
    add('pump_required', true, 'pompa');
  else if (/tanpa pompa|gravitasi saja|nggak pakai pompa|tidak pakai pompa/.test(whole))
    add('pump_required', false, 'tanpa pompa');

  if (/\bdatar\b/.test(whole)) add('terrain', 'Datar', 'datar');
  else if (/\bmiring\b|\bberbukit\b|\bmenanjak\b/.test(whole)) add('terrain', 'Miring', 'miring');
  else if (/bergelombang|naik turun/.test(whole)) add('terrain', 'Bergelombang', 'bergelombang');

  const material =
    /pipa\s+(pvc|hdpe|ppr|galvanis|gip)\b|(pvc|hdpe|ppr|galvanis)\s+(?:yang )?(?:sudah|existing|terpasang|lama)/.exec(
      whole,
    );
  if (material) {
    const name = (material[1] ?? material[2])!;
    const label =
      name === 'pvc'
        ? 'PVC (uPVC)'
        : name === 'gip'
          ? 'Galvanis'
          : name.toUpperCase() === 'GALVANIS'
            ? 'Galvanis'
            : name.toUpperCase();
    add('material', label === 'GALVANIS' ? 'Galvanis' : label, material[0]);
  }

  if (/\btruk\b|kendaraan berat|\bberat\b/.test(whole)) add('traffic_load', 'Truk / berat', 'truk');
  else if (/\bmobil\b/.test(whole)) add('traffic_load', 'Mobil', 'mobil');

  return out;
}
