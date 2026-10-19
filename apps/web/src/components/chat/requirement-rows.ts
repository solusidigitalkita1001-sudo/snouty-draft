/**
 * Baris "KEBUTUHAN ANDA" di panel kanan — dari `RequirementState`, label dan nilai
 * polos seperti prototipe. Setiap baris juga membawa cara mengeditnya (mode "Ubah"):
 * pilihan untuk field enum, angka untuk hitungan. Kosakatanya sama dengan skema
 * ekstraksi dan `PATCH /requirement`; UI tidak menambah pilihan sendiri.
 */

import type { Provenance, RequirementFieldPath, RequirementState } from '@snouty/shared-types';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export type RowEditor =
  /** `boolean`: pilihan 'true'/'false' dikirim sebagai boolean ke PATCH (P22-03). */
  | { readonly kind: 'select'; readonly options: readonly SelectOption[]; readonly boolean?: true }
  | { readonly kind: 'number'; readonly min: number; readonly max: number }
  /** Panjang × lebar diketik bebas ("8 x 12"); `target` memilih bangunan atau tanah. */
  | { readonly kind: 'size'; readonly target: 'building' | 'land' };

export interface RequirementRow {
  /** Kunci baris — unik; dua baris ukuran (bangunan, tanah) berbagi satu `path`. */
  readonly key: string;
  readonly path: RequirementFieldPath;
  readonly label: string;
  readonly display: string;
  /** Nilai mentah untuk input edit; `null` = belum diisi. */
  readonly raw: string | number | null;
  readonly provenance: Provenance;
  /** Alasan asumsi, bila ada — muncul sebagai judul bantuan. */
  readonly reason?: string;
  readonly editor: RowEditor;
}

export const MISSING = 'Belum diisi';

const SOURCE: readonly SelectOption[] = [
  { value: 'rooftop_tank', label: 'Toren atap' },
  { value: 'ground_tank', label: 'Toren bawah' },
  { value: 'pump', label: 'Pompa' },
  { value: 'municipal', label: 'PDAM' },
];

const INSTALLATION: readonly SelectOption[] = [
  { value: 'clean_water', label: 'Air bersih' },
  { value: 'drainage', label: 'Pembuangan' },
  { value: 'both', label: 'Air bersih + pembuangan' },
];

/** Pekerjaan (P22-03): instalasi baru, atau pipa lama diganti ke Pralon. */
const WORK: readonly SelectOption[] = [
  { value: 'false', label: 'Instalasi baru' },
  { value: 'true', label: 'Ganti pipa lama' },
];

/** Jenis pekerjaan renovasi (P23-03). */
const WORK_TYPE: readonly SelectOption[] = [
  { value: 'new', label: 'Instalasi baru' },
  { value: 'replace_all', label: 'Ganti semua pipa' },
  { value: 'replace_partial', label: 'Ganti sebagian' },
  { value: 'extend', label: 'Perluasan (tambah titik air)' },
];
const EXISTING_SIZE: readonly SelectOption[] = ['1/2"', '3/4"', '1"', '1 1/4"', '1 1/2"', '2"'].map(
  (size) => ({ value: size, label: size }),
);
const EXISTING_MATERIAL: readonly SelectOption[] = [
  { value: 'pvc', label: 'PVC' },
  { value: 'galvanized', label: 'Galvanis / besi' },
  { value: 'hdpe', label: 'HDPE' },
  { value: 'ppr', label: 'PPR' },
];

const BUILDING: readonly SelectOption[] = [
  { value: 'residential', label: 'Rumah tinggal' },
  { value: 'boarding_house', label: 'Rumah kos' },
  { value: 'light_commercial', label: 'Komersial ringan' },
  { value: 'industrial', label: 'Industri' },
  { value: 'place_of_worship', label: 'Tempat ibadah' },
  { value: 'public_building', label: 'Sekolah / klinik' },
];

interface PlanValue {
  readonly lengthM?: number;
  readonly widthM?: number;
  readonly areaM2?: number;
  readonly mainRunMeters?: number;
  readonly landLengthM?: number;
  readonly landWidthM?: number;
  readonly landAreaM2?: number;
}

/**
 * Panjang × lebar yang diketik ("8 x 12", "8×12,5", "8 12") → angka; selain itu `null`. Parser
 * nilai terstruktur — batasnya diperiksa lagi di API.
 */
export function sizeFromText(value: string): { lengthM: number; widthM: number } | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(?:[x×*]|\s)\s*(\d+(?:[.,]\d+)?)\s*(?:m)?\s*$/i.exec(value);
  if (!m) return null;
  const lengthM = Number(m[1]!.replace(',', '.'));
  const widthM = Number(m[2]!.replace(',', '.'));
  return lengthM > 0 && widthM > 0 ? { lengthM, widthM } : null;
}

/** Nilai PATCH untuk baris ukuran: bangunan atau tanah, dari teks "P x L". */
export function sizePatch(
  target: 'building' | 'land',
  text: string,
): Record<string, number> | null {
  const size = sizeFromText(text);
  if (size === null) return null;
  return target === 'building'
    ? { lengthM: size.lengthM, widthM: size.widthM }
    : { landLengthM: size.lengthM, landWidthM: size.widthM };
}

const num = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });

/**
 * Dua baris ukuran (permintaan pemilik 2026-10-12): bangunan — dasar hitungan — dan tanah, yang
 * hanya menambah jarak halaman. Keduanya diketik bebas.
 */
function sizeRows(field: {
  value: unknown;
  provenance: Provenance;
  reason?: string;
}): readonly RequirementRow[] {
  const plan = field.value as PlanValue | null;
  const building =
    plan?.lengthM !== undefined && plan.widthM !== undefined
      ? {
          display: `${num(plan.lengthM)} × ${num(plan.widthM)} m`,
          raw: `${plan.lengthM} x ${plan.widthM}`,
        }
      : plan?.areaM2 !== undefined
        ? { display: `luas ${num(plan.areaM2)} m²`, raw: null }
        : plan?.mainRunMeters !== undefined
          ? { display: `jalur ${num(plan.mainRunMeters)} m`, raw: null }
          : { display: MISSING, raw: null };
  const land =
    plan?.landLengthM !== undefined && plan.landWidthM !== undefined
      ? {
          display: `${num(plan.landLengthM)} × ${num(plan.landWidthM)} m`,
          raw: `${plan.landLengthM} x ${plan.landWidthM}`,
        }
      : plan?.landAreaM2 !== undefined
        ? { display: `luas ${num(plan.landAreaM2)} m²`, raw: null }
        : { display: MISSING, raw: null };
  const common = {
    path: 'building.dimensions' as const,
    provenance: field.provenance,
    ...(field.reason !== undefined ? { reason: field.reason } : {}),
  };
  return [
    {
      ...common,
      key: 'building.dimensions.building',
      label: 'Ukuran bangunan',
      ...building,
      editor: { kind: 'size', target: 'building' },
    },
    {
      ...common,
      key: 'building.dimensions.land',
      label: 'Ukuran tanah',
      ...land,
      editor: { kind: 'size', target: 'land' },
    },
  ];
}

const labelOf = (options: readonly SelectOption[]) => (v: unknown) =>
  options.find((o) => o.value === String(v))?.label ?? String(v);

/** Keran wudhu, tempat wudhu, urinoir — hanya untuk tempat ibadah; state lama boleh tanpa field. */
function worshipRows(state: RequirementState): readonly RequirementRow[] {
  const type = state.building.type.value;
  const empty = { value: null, provenance: 'UNAVAILABLE' as const };
  const count = (max: number): RowEditor => ({ kind: 'number', min: 0, max });
  // Sekolah / klinik: toilet umum tanpa wudhu — hanya urinoir.
  if (type === 'public_building') {
    return [
      row('fixtures.urinals', 'Urinoir', state.fixtures.urinals ?? empty, String, count(200)),
    ];
  }
  if (type !== 'place_of_worship') return [];
  return [
    row('fixtures.wudhuTaps', 'Keran wudhu', state.fixtures.wudhuTaps ?? empty, String, count(500)),
    row(
      'fixtures.wudhuAreas',
      'Tempat wudhu',
      state.fixtures.wudhuAreas ?? empty,
      String,
      count(50),
    ),
    row('fixtures.urinals', 'Urinoir', state.fixtures.urinals ?? empty, String, count(200)),
  ];
}

export function requirementRows(state: RequirementState): readonly RequirementRow[] {
  const worship =
    state.building.type.value === 'place_of_worship' ||
    state.building.type.value === 'public_building';
  return [
    row('building.type', 'Tipe bangunan', state.building.type, labelOf(BUILDING), {
      kind: 'select',
      options: BUILDING,
    }),
    row('building.floors', 'Jumlah lantai', state.building.floors, String, {
      kind: 'number',
      min: 1,
      max: 50,
    }),
    ...sizeRows(state.building.dimensions),
    row('fixtures.bathrooms', 'Kamar mandi', state.fixtures.bathrooms, String, {
      kind: 'number',
      min: 0,
      max: 200,
    }),
    row('fixtures.basins', 'Wastafel', state.fixtures.basins, String, {
      kind: 'number',
      min: 0,
      max: 200,
    }),
    ...worshipRows(state),
    // Tempat ibadah lazimnya tanpa dapur; barisnya hanya tampil bila memang disebut.
    ...(worship && state.fixtures.kitchens.value === null
      ? []
      : [
          row('fixtures.kitchens', 'Dapur', state.fixtures.kitchens, String, {
            kind: 'number',
            min: 0,
            max: 100,
          }),
        ]),
    row('water.source', 'Sumber air', state.water.source, labelOf(SOURCE), {
      kind: 'select',
      options: SOURCE,
    }),
    row(
      'water.installationType',
      'Jenis instalasi',
      state.water.installationType,
      labelOf(INSTALLATION),
      { kind: 'select', options: INSTALLATION },
    ),
    // State lama tidak punya field ini; barisnya tampil hanya bila ada.
    ...(state.water.replaceExisting && !state.water.workType
      ? [
          row('water.replaceExisting', 'Pekerjaan', state.water.replaceExisting, labelOf(WORK), {
            kind: 'select',
            options: WORK,
            boolean: true,
          }),
        ]
      : []),
    ...renovationRows(state),
  ];
}

/** Renovasi (P23-03): jenis pekerjaan selalu bisa diubah; data pipa lama hanya bila relevan. */
function renovationRows(state: RequirementState): RequirementRow[] {
  const work = state.water.workType;
  // Hanya bila pekerjaannya disebut (P24, regresi Fase 23): state baru membawa field kosong ini, dan
  // rumah bangun baru tidak boleh menampilkan "Jenis pekerjaan / Bahan pipa lama: Belum diisi".
  if (!work || work.value === null) return [];
  const mode = work.value;
  const rows: RequirementRow[] = [
    row('water.workType', 'Jenis pekerjaan', work, labelOf(WORK_TYPE), {
      kind: 'select',
      options: WORK_TYPE,
    }),
  ];
  if (mode === 'extend' && state.water.existingMainSize) {
    rows.push(
      row('water.existingMainSize', 'Ukuran pipa lama', state.water.existingMainSize, String, {
        kind: 'select',
        options: EXISTING_SIZE,
      }),
    );
  }
  if (mode === 'extend' && state.water.existingOutlets) {
    rows.push(
      row(
        'water.existingOutlets',
        'Titik air yang sudah ada',
        state.water.existingOutlets,
        String,
        {
          kind: 'number',
          min: 0,
          max: 1000,
        },
      ),
    );
  }
  if (mode === 'replace_partial' && state.water.replacementLengthM) {
    rows.push(
      row(
        'water.replacementLengthM',
        'Panjang yang diganti (m)',
        state.water.replacementLengthM,
        String,
        {
          kind: 'number',
          min: 1,
          max: 10000,
        },
      ),
    );
  }
  if (
    (mode === 'replace_all' || mode === 'replace_partial' || mode === 'extend') &&
    state.water.existingPipeMaterial
  ) {
    rows.push(
      row(
        'water.existingPipeMaterial',
        'Bahan pipa lama',
        state.water.existingPipeMaterial,
        labelOf(EXISTING_MATERIAL),
        { kind: 'select', options: EXISTING_MATERIAL },
      ),
    );
  }
  return rows;
}

function row(
  path: RequirementFieldPath,
  label: string,
  field: { value: unknown; provenance: Provenance; reason?: string },
  format: (value: unknown) => string,
  editor: RowEditor,
): RequirementRow {
  // UNAVAILABLE tidak pernah merender nilai — ketiadaan ditampilkan apa adanya.
  const missing = field.value === null || field.value === undefined;
  return {
    key: path,
    path,
    label,
    display: missing ? MISSING : format(field.value),
    raw: missing ? null : (field.value as string | number),
    provenance: field.provenance,
    ...(field.reason !== undefined ? { reason: field.reason } : {}),
    editor,
  };
}
