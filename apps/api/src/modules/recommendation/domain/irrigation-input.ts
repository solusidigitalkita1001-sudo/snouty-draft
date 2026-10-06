/**
 * Menerjemahkan jawaban jalur irigasi (label pilihan, `RequirementState.useCase`) ke masukan
 * engine irigasi (OQ-47). Label → angka di sini, bukan di engine: engine menerima angka
 * yang sudah pasti, dan setiap pengisian dari rentang/ketidaktahuan DICATAT sebagai asumsi
 * supaya tampil di kartu "Asumsi yang digunakan" dan bisa diperbaiki.
 */
import type { Assumption, IrrigationField, RequirementState } from '@snouty/shared-types';
import type { IrrigationInput } from '@snouty/engineering';

const UNKNOWN = 'Belum tahu';

/** Titik tengah rentang luas (ha). */
const AREA_BUCKET: Readonly<Record<string, number>> = {
  'Di bawah 0,5 ha': 0.25,
  '0,5–1 ha': 0.75,
  '1–2 ha': 1.5,
  'Di atas 2 ha': 3,
};

const METHOD: Readonly<Record<string, IrrigationInput['method']>> = {
  'Genangan / gravitasi': 'flood',
  Sprinkler: 'sprinkler',
  Tetes: 'drip',
};

/** Titik tengah rentang jarak (m). */
const DISTANCE_BUCKET: Readonly<Record<string, number>> = {
  'Di bawah 50 m': 25,
  '50–200 m': 125,
  '200–500 m': 350,
  'Di atas 500 m': 750,
};

const ELEVATION: Readonly<Record<string, IrrigationInput['elevation']>> = {
  'Lebih rendah': 'lower',
  Sejajar: 'level',
  'Lebih tinggi': 'higher',
};

export interface IrrigationInputResult {
  readonly input: IrrigationInput;
  /** Nilai yang diisi dari rentang/ketidaktahuan — bukan dari angka yang disebut pengguna. */
  readonly assumptions: readonly Assumption[];
}

export function irrigationInputFrom(state: RequirementState): IrrigationInputResult {
  const answers = state.useCase?.kind === 'irrigation' ? state.useCase.answers : {};
  const assumptions: Assumption[] = [];
  const assume = (field: IrrigationField, text: string) =>
    assumptions.push({ text, fieldPath: field, ruleId: 'ENG-101' });

  const areaRaw = answers['irrigation.areaHa'];
  const explicitHa = areaRaw ? /^(\d+(?:[.,]\d+)?)\s*ha$/.exec(areaRaw) : null;
  let areaHa: number;
  if (explicitHa) {
    areaHa = Number(explicitHa[1]!.replace(',', '.'));
  } else if (areaRaw && AREA_BUCKET[areaRaw] !== undefined) {
    areaHa = AREA_BUCKET[areaRaw]!;
    assume(
      'irrigation.areaHa',
      `Luas lahan diambil titik tengah rentang "${areaRaw}": ${areaHa} ha.`,
    );
  } else {
    areaHa = 1;
    assume('irrigation.areaHa', 'Luas lahan belum disebut; diasumsikan 1 ha.');
  }

  const methodRaw = answers['irrigation.method'];
  let method: IrrigationInput['method'];
  if (methodRaw && METHOD[methodRaw]) {
    method = METHOD[methodRaw]!;
  } else {
    method = 'flood';
    assume('irrigation.method', 'Jenis irigasi belum dipilih; diasumsikan genangan/gravitasi.');
  }

  const distanceRaw = answers['irrigation.distance'];
  let mainRunMeters: number;
  if (distanceRaw && DISTANCE_BUCKET[distanceRaw] !== undefined) {
    mainRunMeters = DISTANCE_BUCKET[distanceRaw]!;
    assume(
      'irrigation.distance',
      `Jarak sumber ke lahan diambil titik tengah rentang "${distanceRaw}": ${mainRunMeters} m.`,
    );
  } else {
    mainRunMeters = 125;
    assume('irrigation.distance', 'Jarak sumber ke lahan belum disebut; diasumsikan 125 m.');
  }

  const elevationRaw = answers['irrigation.elevation'];
  let elevation: IrrigationInput['elevation'];
  if (elevationRaw && ELEVATION[elevationRaw]) {
    elevation = ELEVATION[elevationRaw]!;
  } else {
    elevation = 'level';
    assume('irrigation.elevation', 'Posisi sumber air belum disebut; diasumsikan sejajar lahan.');
  }

  // Jawaban "Belum tahu" eksplisit tetap tercatat sebagai asumsi (bukan dilewati diam-diam).
  for (const field of [
    'irrigation.method',
    'irrigation.distance',
    'irrigation.elevation',
  ] as const) {
    if (answers[field] === UNKNOWN && !assumptions.some((a) => a.fieldPath === field)) {
      assume(field, `${field} dijawab "Belum tahu"; nilai asumsi dipakai.`);
    }
  }

  return { input: { areaHa, method, mainRunMeters, elevation }, assumptions };
}
