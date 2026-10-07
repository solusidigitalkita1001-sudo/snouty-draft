/**
 * Kelompok G — kolam / tambak ikan (Fase 14, laporan pemilik "tambak lele 4 x 4 meter").
 * docs/ENGINEERING_RULES.md §3.
 *
 * Yang dihitung: volume air, debit pengisian dari lama pengisian, diameter pipa masuk
 * (kontinuitas, memakai ENG-102), diameter pipa pembuangan gravitasi dari lama pengurasan,
 * dan BOM tata letak sederhana. Tidak ada aerasi, filtrasi, atau kualitas air — itu di luar
 * perpipaan. Semua `REQUIRES_DOMAIN_VALIDATION`.
 */

import { localized, requireInt, requireNumber, type RuleVersion } from '../rule.js';
import { round1, round2 } from '../units.js';
import { NOMINAL_SIZES } from './group-e-irrigation.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;
const ROD_METERS = 4;

// ── ENG-301 · Volume air kolam ──────────────────────────────────────────────

export interface PondVolumeInput {
  readonly lengthM: number;
  readonly widthM: number;
  readonly depthM: number;
  readonly ponds: number;
}
export interface PondVolumeResult {
  readonly areaM2: number;
  /** Volume per kolam, m³. */
  readonly volumePerPondM3: number;
  /** Volume seluruh kolam, m³. */
  readonly volumeM3: number;
}

export const ENG_301: RuleVersion<PondVolumeInput, PondVolumeResult> = {
  ruleId: 'ENG-301',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      lengthM: requireNumber('ENG-301', 'lengthM', o['lengthM'], { min: 0.5, max: 500 }),
      widthM: requireNumber('ENG-301', 'widthM', o['widthM'], { min: 0.5, max: 500 }),
      depthM: requireNumber('ENG-301', 'depthM', o['depthM'], { min: 0.2, max: 5 }),
      ponds: requireInt('ENG-301', 'ponds', o['ponds'], { min: 1, max: 500 }),
    };
  },
  compute: (input) => {
    const areaM2 = round2(input.lengthM * input.widthM);
    const perPond = round2(areaM2 * input.depthM);
    return { areaM2, volumePerPondM3: perPond, volumeM3: round2(perPond * input.ponds) };
  },
  sourceReference: 'Geometri: V = panjang × lebar × tinggi air × jumlah kolam',
  validationStatus: PENDING,
  testCases: [
    {
      name: '4 × 4 m, air 1 m, 1 kolam → 16 m³',
      input: { lengthM: 4, widthM: 4, depthM: 1, ponds: 1 },
      expected: { areaM2: 16, volumePerPondM3: 16, volumeM3: 16 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Volume air ${output.volumeM3} m³ = ${input.lengthM} × ${input.widthM} m × tinggi air ${input.depthM} m${input.ponds > 1 ? ` × ${input.ponds} kolam` : ''}.`,
      en: `Water volume ${output.volumeM3} m³ = ${input.lengthM} × ${input.widthM} m × water depth ${input.depthM} m${input.ponds > 1 ? ` × ${input.ponds} ponds` : ''}.`,
    }),
};

// ── ENG-302 · Debit pengisian ───────────────────────────────────────────────

export interface FillFlowInput {
  readonly volumeM3: number;
  readonly fillTimeHours: number;
}
export interface FillFlowResult {
  readonly designFlowLs: number;
  readonly flowM3h: number;
}

export const ENG_302: RuleVersion<FillFlowInput, FillFlowResult> = {
  ruleId: 'ENG-302',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      volumeM3: requireNumber('ENG-302', 'volumeM3', o['volumeM3'], { min: 0.1, max: 1_000_000 }),
      fillTimeHours: requireNumber('ENG-302', 'fillTimeHours', o['fillTimeHours'], {
        min: 0.1,
        max: 240,
      }),
    };
  },
  compute: (input) => ({
    designFlowLs: round2((input.volumeM3 * 1000) / (input.fillTimeHours * 3600)),
    flowM3h: round2(input.volumeM3 / input.fillTimeHours),
  }),
  sourceReference: 'Q = V / t',
  validationStatus: PENDING,
  testCases: [
    {
      name: '16 m³ dalam 3 jam → 1,48 l/s',
      input: { volumeM3: 16, fillTimeHours: 3 },
      expected: { designFlowLs: 1.48, flowM3h: 5.33 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Debit pengisian ${output.designFlowLs} l/s (${output.flowM3h} m³/jam) = ${input.volumeM3} m³ ÷ ${input.fillTimeHours} jam.`,
      en: `Filling flow ${output.designFlowLs} l/s (${output.flowM3h} m³/h) = ${input.volumeM3} m³ ÷ ${input.fillTimeHours} h.`,
    }),
};

// ── ENG-303 · Pipa pembuangan gravitasi ─────────────────────────────────────

export interface DrainSizeInput {
  readonly volumePerPondM3: number;
  readonly drainTimeHours: number;
  readonly drainVelocityMs: number;
}
export interface DrainSizeResult {
  readonly drainFlowLs: number;
  readonly requiredInnerDiameterMm: number;
  readonly drainSize: string;
  readonly innerDiameterMm: number;
}

export const ENG_303: RuleVersion<DrainSizeInput, DrainSizeResult> = {
  ruleId: 'ENG-303',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      volumePerPondM3: requireNumber('ENG-303', 'volumePerPondM3', o['volumePerPondM3'], {
        min: 0.1,
        max: 100_000,
      }),
      drainTimeHours: requireNumber('ENG-303', 'drainTimeHours', o['drainTimeHours'], {
        min: 0.1,
        max: 48,
      }),
      drainVelocityMs: requireNumber('ENG-303', 'drainVelocityMs', o['drainVelocityMs'], {
        min: 0.3,
        max: 3,
      }),
    };
  },
  compute: (input) => {
    const flowLs = round2((input.volumePerPondM3 * 1000) / (input.drainTimeHours * 3600));
    const requiredMm = round1(
      Math.sqrt((4 * (flowLs / 1000)) / (Math.PI * input.drainVelocityMs)) * 1000,
    );
    const pick = NOMINAL_SIZES.find((s) => s.innerMm >= requiredMm) ?? NOMINAL_SIZES.at(-1)!;
    return {
      drainFlowLs: flowLs,
      requiredInnerDiameterMm: requiredMm,
      drainSize: pick.size,
      innerDiameterMm: pick.innerMm,
    };
  },
  sourceReference:
    'Q = V / t_kuras ; D = √(4Q / πv) dengan v gravitasi ±1 m/s; ukuran nominal terdekat di atasnya',
  validationStatus: PENDING,
  testCases: [
    {
      name: '16 m³ dikuras 1 jam pada 1 m/s → 4,44 l/s → 75,2 mm → 3"',
      input: { volumePerPondM3: 16, drainTimeHours: 1, drainVelocityMs: 1 },
      expected: {
        drainFlowLs: 4.44,
        requiredInnerDiameterMm: 75.2,
        drainSize: '3"',
        innerDiameterMm: 80,
      },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Pipa kuras ${output.drainSize}: menguras ${input.volumePerPondM3} m³ dalam ${input.drainTimeHours} jam butuh ${output.drainFlowLs} l/s → diameter dalam minimum ${output.requiredInnerDiameterMm} mm pada ${input.drainVelocityMs} m/s (gravitasi).`,
      en: `Drain pipe ${output.drainSize}: draining ${input.volumePerPondM3} m³ in ${input.drainTimeHours} h needs ${output.drainFlowLs} l/s → minimum inner diameter ${output.requiredInnerDiameterMm} mm at ${input.drainVelocityMs} m/s (gravity).`,
    }),
};

// ── ENG-304 · BOM kolam ─────────────────────────────────────────────────────

export interface PondBomInput {
  readonly ponds: number;
  readonly lengthM: number;
  readonly depthM: number;
  readonly routeLengthM: number;
  readonly inletSize: string;
  readonly drainSize: string;
}
export interface PondBomLine {
  readonly item: string;
  readonly size: string;
  readonly quantity: number;
  readonly unit: 'batang' | 'pcs' | 'kaleng' | 'meter';
}
export interface PondBomResult {
  readonly inletMeters: number;
  readonly drainMeters: number;
  readonly lines: readonly PondBomLine[];
}

export const ENG_304: RuleVersion<PondBomInput, PondBomResult> = {
  ruleId: 'ENG-304',
  version: 1,
  category: 'material',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      ponds: requireInt('ENG-304', 'ponds', o['ponds'], { min: 1, max: 500 }),
      lengthM: requireNumber('ENG-304', 'lengthM', o['lengthM'], { min: 0.5, max: 500 }),
      depthM: requireNumber('ENG-304', 'depthM', o['depthM'], { min: 0.2, max: 5 }),
      routeLengthM: requireNumber('ENG-304', 'routeLengthM', o['routeLengthM'], {
        min: 1,
        max: 5_000,
      }),
      inletSize: String(o['inletSize'] ?? ''),
      drainSize: String(o['drainSize'] ?? ''),
    };
  },
  compute: (input) => {
    // Pipa masuk: jalur dari sumber + 2 m per kolam (turun ke bibir kolam).
    const inletMeters = Math.ceil(input.routeLengthM + 2 * input.ponds);
    // Pipa kuras per kolam: pipa tegak (tinggi air + 0,3 m), tembus dinding, lalu ke saluran
    // sejauh ±setengah panjang kolam.
    const drainMeters = Math.ceil(input.ponds * (input.depthM + 0.3 + 1 + input.lengthM / 2));
    const lines: PondBomLine[] = [
      {
        item: 'Pipa PVC AW',
        size: input.inletSize,
        quantity: Math.ceil(inletMeters / ROD_METERS),
        unit: 'batang',
      },
      { item: 'Elbow 90°', size: input.inletSize, quantity: 2 + input.ponds, unit: 'pcs' },
      { item: 'Katup / stop kran', size: input.inletSize, quantity: input.ponds, unit: 'pcs' },
      {
        item: 'Pipa PVC D',
        size: input.drainSize,
        quantity: Math.ceil(drainMeters / ROD_METERS),
        unit: 'batang',
      },
      { item: 'Elbow 90°', size: input.drainSize, quantity: 2 * input.ponds, unit: 'pcs' },
      {
        item: 'Sok drat / water mur (pipa tegak kuras)',
        size: input.drainSize,
        quantity: input.ponds,
        unit: 'pcs',
      },
      { item: 'Lem PVC', size: '-', quantity: 1, unit: 'kaleng' },
    ];
    if (input.ponds > 1) {
      lines.splice(1, 0, {
        item: 'Tee',
        size: input.inletSize,
        quantity: input.ponds - 1,
        unit: 'pcs',
      });
    }
    return { inletMeters, drainMeters, lines };
  },
  sourceReference:
    'Estimasi tata letak: pipa masuk = jalur + 2 m/kolam; pipa kuras = tegak (air + 0,3 m) + tembus 1 m + ½ panjang kolam; batang 4 m',
  validationStatus: PENDING,
  testCases: [
    {
      name: '1 kolam 4 m, air 1 m, jalur 10 m, masuk 1½", kuras 3"',
      input: {
        ponds: 1,
        lengthM: 4,
        depthM: 1,
        routeLengthM: 10,
        inletSize: '1½"',
        drainSize: '3"',
      },
      expected: {
        inletMeters: 12,
        drainMeters: 5,
        lines: [
          { item: 'Pipa PVC AW', size: '1½"', quantity: 3, unit: 'batang' },
          { item: 'Elbow 90°', size: '1½"', quantity: 3, unit: 'pcs' },
          { item: 'Katup / stop kran', size: '1½"', quantity: 1, unit: 'pcs' },
          { item: 'Pipa PVC D', size: '3"', quantity: 2, unit: 'batang' },
          { item: 'Elbow 90°', size: '3"', quantity: 2, unit: 'pcs' },
          { item: 'Sok drat / water mur (pipa tegak kuras)', size: '3"', quantity: 1, unit: 'pcs' },
          { item: 'Lem PVC', size: '-', quantity: 1, unit: 'kaleng' },
        ],
      },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Pipa masuk ±${output.inletMeters} m (jalur ${input.routeLengthM} m + 2 m per kolam) PVC AW ${input.inletSize}; pipa kuras ±${output.drainMeters} m PVC D ${input.drainSize} (tegak + tembus + ½ panjang kolam) untuk ${input.ponds} kolam; batang 4 m.`,
      en: `Inlet pipe ±${output.inletMeters} m (route ${input.routeLengthM} m + 2 m per pond) PVC AW ${input.inletSize}; drain pipe ±${output.drainMeters} m PVC D ${input.drainSize} (standpipe + wall pass-through + ½ pond length) for ${input.ponds} ponds; 4 m pipe lengths.`,
    }),
};

export const GROUP_G = [ENG_301, ENG_302, ENG_303, ENG_304] as const;
