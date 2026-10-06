/**
 * Kelompok E — irigasi (OQ-47). docs/ENGINEERING_RULES.md §3.
 *
 * Keputusan pemilik 2026-10-06: irigasi dihitung seperti rumah. Aturannya diturunkan dari
 * rumus teknik umum yang terdokumentasi — **bukan** dari prototipe (prototipe hanya mendesain
 * bangunan) dan bukan dari ingatan model. Semua `REQUIRES_DOMAIN_VALIDATION`: gerbang
 * provenance menjadikan setiap keluarannya `ASSUMED`, dan kartu asumsi menyebutkannya.
 * Validasi tim teknis Pralon adalah prasyarat sebelum angka-angka ini pantas dipercaya.
 *
 * Rujukan yang dipakai (ditulis di `sourceReference` tiap aturan): Kriteria Perencanaan
 * Irigasi KP-01 (kebutuhan air padi ±1,2–1,5 l/s/ha), praktik umum sprinkler/tetes, batas
 * kecepatan aliran pipa plastik 1–2 m/s, rumus kontinuitas Q = v·A.
 */

import { assumption } from '../parameters/assumptions.js';
import {
  PVC_INCH_SIZES,
  sizeTable,
  type NominalSize,
  type SizeTableId,
} from '../parameters/size-tables.js';
import { requireNumber, RuleInputError, type RuleVersion } from '../rule.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

export type IrrigationMethod = 'flood' | 'sprinkler' | 'drip';
export type SourceElevation = 'lower' | 'level' | 'higher';

function requireMethod(ruleId: string, raw: unknown): IrrigationMethod {
  if (raw === 'flood' || raw === 'sprinkler' || raw === 'drip') return raw;
  throw new RuleInputError(ruleId, `method ${String(raw)}`);
}

function requireElevation(ruleId: string, raw: unknown): SourceElevation {
  if (raw === 'lower' || raw === 'level' || raw === 'higher') return raw;
  throw new RuleInputError(ruleId, `elevation ${String(raw)}`);
}

// ── ENG-101 · Debit rencana ─────────────────────────────────────────────────

export interface DesignFlowInput {
  readonly areaHa: number;
  readonly method: IrrigationMethod;
}
export interface DesignFlowResult {
  /** Debit rencana, liter per detik. */
  readonly designFlowLs: number;
  /** Debit satuan yang dipakai, l/s/ha. */
  readonly dutyLsPerHa: number;
}

/**
 * Debit satuan per metode — dibaca dari registry asumsi terpusat, bukan konstanta lokal:
 * angkanya tampil ke pengguna dengan ID yang sama dan diganti di satu tempat.
 */
const DUTY_ASSUMPTION_ID: Readonly<Record<IrrigationMethod, string>> = {
  flood: 'IRRIGATION_PRELIMINARY_FLOW_FLOOD',
  sprinkler: 'IRRIGATION_PRELIMINARY_FLOW_SPRINKLER',
  drip: 'IRRIGATION_PRELIMINARY_FLOW_DRIP',
};
const DUTY_LS_PER_HA: Readonly<Record<IrrigationMethod, number>> = {
  flood: assumption(DUTY_ASSUMPTION_ID.flood).value as number,
  sprinkler: assumption(DUTY_ASSUMPTION_ID.sprinkler).value as number,
  drip: assumption(DUTY_ASSUMPTION_ID.drip).value as number,
};

/** ID asumsi registry yang dipakai ENG-101 untuk sebuah metode. */
export function irrigationDutyAssumptionId(method: IrrigationMethod): string {
  return DUTY_ASSUMPTION_ID[method];
}

const METHOD_LABEL: Readonly<Record<IrrigationMethod, string>> = {
  flood: 'genangan/gravitasi',
  sprinkler: 'sprinkler',
  drip: 'tetes',
};

export const ENG_101: RuleVersion<DesignFlowInput, DesignFlowResult> = {
  ruleId: 'ENG-101',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      areaHa: requireNumber('ENG-101', 'areaHa', o['areaHa'], { min: 0.05, max: 500 }),
      method: requireMethod('ENG-101', o['method']),
    };
  },
  compute: (input) => {
    const duty = DUTY_LS_PER_HA[input.method];
    return { designFlowLs: round2(input.areaHa * duty), dutyLsPerHa: duty };
  },
  sourceReference:
    'KP-01 Kriteria Perencanaan Irigasi (padi ±1,2–1,5 l/s/ha); praktik umum sprinkler ±0,8 dan tetes ±0,5 l/s/ha',
  validationStatus: PENDING,
  testCases: [
    {
      name: '1 ha genangan',
      input: { areaHa: 1, method: 'flood' },
      expected: { designFlowLs: 1.5, dutyLsPerHa: 1.5 },
    },
    {
      name: '1,5 ha sprinkler',
      input: { areaHa: 1.5, method: 'sprinkler' },
      expected: { designFlowLs: 1.2, dutyLsPerHa: 0.8 },
    },
  ],
  explain: (input, output) =>
    `Debit rencana ${output.designFlowLs} l/s = ${input.areaHa} ha × ${output.dutyLsPerHa} l/s/ha (irigasi ${METHOD_LABEL[input.method]}).`,
};

// ── ENG-102 · Diameter jalur utama dari debit ───────────────────────────────

export interface MainSizeFromFlowInput {
  readonly designFlowLs: number;
  /** Kecepatan aliran rencana, m/s. */
  readonly velocityMs: number;
  /** Tabel ukuran: inci untuk PVC, mm (OD) untuk HDPE/MDPE. Bawaan inci. */
  readonly sizeTable: SizeTableId;
}
export interface MainSizeFromFlowResult {
  readonly requiredInnerDiameterMm: number;
  readonly mainSize: string;
  readonly innerDiameterMm: number;
}

/** Tabel inci — tetap diekspor untuk pemakai lama; isinya `PVC_INCH_SIZES` (size-tables.ts). */
export const NOMINAL_SIZES: readonly NominalSize[] = PVC_INCH_SIZES;

export const ENG_102: RuleVersion<MainSizeFromFlowInput, MainSizeFromFlowResult> = {
  ruleId: 'ENG-102',
  version: 2,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      designFlowLs: requireNumber('ENG-102', 'designFlowLs', o['designFlowLs'], {
        min: 0.01,
        max: 5_000,
      }),
      velocityMs: requireNumber('ENG-102', 'velocityMs', o['velocityMs'], { min: 0.3, max: 3 }),
      sizeTable: requireSizeTable('ENG-102', o['sizeTable']),
    };
  },
  compute: (input) => {
    const flowM3s = input.designFlowLs / 1000;
    const requiredM = Math.sqrt((4 * flowM3s) / (Math.PI * input.velocityMs));
    const requiredMm = round1(requiredM * 1000);
    const table = sizeTable(input.sizeTable);
    const pick = table.find((s) => s.innerMm >= requiredMm) ?? table.at(-1)!;
    return {
      requiredInnerDiameterMm: requiredMm,
      mainSize: pick.size,
      innerDiameterMm: pick.innerMm,
    };
  },
  sourceReference:
    'Kontinuitas Q = v·A, D = √(4Q/πv); kecepatan rencana pipa plastik 1–2 m/s (praktik umum)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '1,5 l/s pada 1,5 m/s → 35,7 mm → 1½"',
      input: { designFlowLs: 1.5, velocityMs: 1.5, sizeTable: 'pvc_inch' },
      expected: { requiredInnerDiameterMm: 35.7, mainSize: '1½"', innerDiameterMm: 40 },
    },
    {
      name: '0,5 l/s pada 1,5 m/s → 20,6 mm → 1"',
      input: { designFlowLs: 0.5, velocityMs: 1.5, sizeTable: 'pvc_inch' },
      expected: { requiredInnerDiameterMm: 20.6, mainSize: '1"', innerDiameterMm: 25 },
    },
  ],
  explain: (input, output) =>
    `Diameter dalam minimum ${output.requiredInnerDiameterMm} mm untuk ${input.designFlowLs} l/s pada ${input.velocityMs} m/s; ukuran nominal terdekat di atasnya ${output.mainSize} (±${output.innerDiameterMm} mm).`,
};

// ── ENG-103 · Kebutuhan tekanan dan pompa ───────────────────────────────────

export interface PressureNeedInput {
  readonly method: IrrigationMethod;
  readonly elevation: SourceElevation;
}
export interface PressureNeedResult {
  readonly pumpRequired: boolean;
  readonly pressureClass: 'AW' | 'D';
  readonly note: string;
}

export const ENG_103: RuleVersion<PressureNeedInput, PressureNeedResult> = {
  ruleId: 'ENG-103',
  version: 1,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      method: requireMethod('ENG-103', o['method']),
      elevation: requireElevation('ENG-103', o['elevation']),
    };
  },
  compute: (input) => {
    // Sprinkler dan tetes butuh tekanan kerja di emitter; beda tinggi sumber yang sedikit
    // lebih tinggi tidak cukup — pompa diperlukan. Genangan mengalir gravitasi bila sumber
    // lebih tinggi; selain itu dipompa.
    const pumpRequired = input.method !== 'flood' || input.elevation !== 'higher';
    return {
      pumpRequired,
      pressureClass: pumpRequired ? 'AW' : 'D',
      note: pumpRequired
        ? 'jalur bertekanan pompa → pipa kelas AW'
        : 'aliran gravitasi dari sumber yang lebih tinggi → kelas D memadai',
    };
  },
  sourceReference:
    'Sprinkler ±2–3 bar dan tetes ±1–1,5 bar di emitter (praktik umum); genangan gravitasi tanpa tekanan',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'sprinkler, sumber sejajar',
      input: { method: 'sprinkler', elevation: 'level' },
      expected: {
        pumpRequired: true,
        pressureClass: 'AW',
        note: 'jalur bertekanan pompa → pipa kelas AW',
      },
    },
    {
      name: 'genangan, sumber lebih tinggi',
      input: { method: 'flood', elevation: 'higher' },
      expected: {
        pumpRequired: false,
        pressureClass: 'D',
        note: 'aliran gravitasi dari sumber yang lebih tinggi → kelas D memadai',
      },
    },
  ],
  explain: (input, output) =>
    `Irigasi ${METHOD_LABEL[input.method]} dengan sumber ${ELEVATION_LABEL[input.elevation]}: ${output.pumpRequired ? 'pompa diperlukan' : 'tanpa pompa'}; ${output.note}.`,
};

const ELEVATION_LABEL: Readonly<Record<SourceElevation, string>> = {
  lower: 'lebih rendah dari lahan',
  level: 'sejajar lahan',
  higher: 'lebih tinggi dari lahan',
};

// ── ENG-104 · Bahan per segmen ──────────────────────────────────────────────

export interface SegmentMaterialInput {
  readonly mainRunMeters: number;
}
export interface SegmentMaterialResult {
  readonly mainFamily: 'HDPE' | 'PVC AW';
  readonly distributionFamily: 'PVC AW';
}

/** Di atas ini jalur utama (ditanam, panjang) lazim memakai HDPE gulungan (registry asumsi). */
export const HDPE_FROM_METERS = Number(
  /\d+/.exec(assumption('HDPE_MAIN_FROM_200M').condition)?.[0] ?? 200,
);

export const ENG_104: RuleVersion<SegmentMaterialInput, SegmentMaterialResult> = {
  ruleId: 'ENG-104',
  version: 1,
  category: 'material',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      mainRunMeters: requireNumber('ENG-104', 'mainRunMeters', o['mainRunMeters'], {
        min: 1,
        max: 20_000,
      }),
    };
  },
  compute: (input) => ({
    mainFamily: input.mainRunMeters >= HDPE_FROM_METERS ? 'HDPE' : 'PVC AW',
    distributionFamily: 'PVC AW',
  }),
  sourceReference:
    'Praktik umum: jalur tanam panjang memakai HDPE (lentur, sedikit sambungan); distribusi tetap memakai PVC AW',
  validationStatus: PENDING,
  testCases: [
    {
      name: '350 m → HDPE',
      input: { mainRunMeters: 350 },
      expected: { mainFamily: 'HDPE', distributionFamily: 'PVC AW' },
    },
    {
      name: '25 m → PVC AW',
      input: { mainRunMeters: 25 },
      expected: { mainFamily: 'PVC AW', distributionFamily: 'PVC AW' },
    },
  ],
  explain: (input, output) =>
    `Jalur utama ${input.mainRunMeters} m ${output.mainFamily === 'HDPE' ? '≥' : '<'} ${HDPE_FROM_METERS} m → ${output.mainFamily}; distribusi di lahan ${output.distributionFamily}.`,
};

// ── ENG-105 · Panjang dan BOM estimasi ──────────────────────────────────────

export interface IrrigationBomInput {
  readonly areaHa: number;
  readonly mainRunMeters: number;
  readonly mainSize: string;
  /** Ukuran distribusi PVC AW di lahan (inci) — berbeda dari jalur utama bila utamanya HDPE (mm). */
  readonly distributionSize: string;
  readonly mainFamily: 'HDPE' | 'PVC AW';
}
export interface IrrigationBomLine {
  readonly item: string;
  readonly size: string;
  readonly quantity: number;
  readonly unit: 'batang' | 'pcs' | 'kaleng' | 'meter';
}
export interface IrrigationBomResult {
  readonly distributionMeters: number;
  readonly lines: readonly IrrigationBomLine[];
}

/** Satu cabang distribusi tiap sekian meter header — asumsi tata letak (registry), bukan desain lahan. */
const BRANCH_SPACING_M = assumption('LATERAL_SPACING_25M').value as number;
const ROD_METERS = 4;

export const ENG_105: RuleVersion<IrrigationBomInput, IrrigationBomResult> = {
  ruleId: 'ENG-105',
  version: 2,
  category: 'material',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const mainFamily = o['mainFamily'];
    if (mainFamily !== 'HDPE' && mainFamily !== 'PVC AW') {
      throw new RuleInputError('ENG-105', 'mainFamily harus HDPE atau PVC AW');
    }
    return {
      areaHa: requireNumber('ENG-105', 'areaHa', o['areaHa'], { min: 0.05, max: 500 }),
      mainRunMeters: requireNumber('ENG-105', 'mainRunMeters', o['mainRunMeters'], {
        min: 1,
        max: 20_000,
      }),
      mainSize: String(o['mainSize'] ?? ''),
      distributionSize: String(o['distributionSize'] ?? o['mainSize'] ?? ''),
      mainFamily,
    };
  },
  compute: (input) => {
    // Header melintasi lahan + satu lateral per cabang: ≈ 2 × sisi lahan (lahan dianggap bujur sangkar).
    const sideM = Math.sqrt(input.areaHa * 10_000);
    const distributionMeters = Math.ceil(2 * sideM);
    const branches = Math.max(1, Math.ceil(sideM / BRANCH_SPACING_M));
    const lines: IrrigationBomLine[] = [];
    if (input.mainFamily === 'HDPE') {
      lines.push({
        item: 'Pipa HDPE',
        size: input.mainSize,
        quantity: input.mainRunMeters,
        unit: 'meter',
      });
    } else {
      lines.push({
        item: 'Pipa PVC AW',
        size: input.mainSize,
        quantity: Math.ceil(input.mainRunMeters / ROD_METERS),
        unit: 'batang',
      });
    }
    lines.push({
      item: 'Pipa PVC AW',
      size: input.distributionSize,
      quantity: Math.ceil(distributionMeters / ROD_METERS),
      unit: 'batang',
    });
    lines.push({ item: 'Tee', size: input.distributionSize, quantity: branches, unit: 'pcs' });
    lines.push({ item: 'Elbow 90°', size: input.distributionSize, quantity: 4, unit: 'pcs' });
    lines.push({
      item: 'Katup / stop kran',
      size: input.distributionSize,
      quantity: branches + 1,
      unit: 'pcs',
    });
    return { distributionMeters, lines };
  },
  sourceReference:
    'Estimasi tata letak: lahan bujur sangkar, header + satu lateral per 25 m; batang PVC 4 m; HDPE per meter',
  validationStatus: PENDING,
  testCases: [
    {
      name: '1 ha, jalur utama 350 m HDPE 1½"',
      input: {
        areaHa: 1,
        mainRunMeters: 350,
        mainSize: '50 mm',
        distributionSize: '1½"',
        mainFamily: 'HDPE',
      },
      expected: {
        distributionMeters: 200,
        lines: [
          { item: 'Pipa HDPE', size: '50 mm', quantity: 350, unit: 'meter' },
          { item: 'Pipa PVC AW', size: '1½"', quantity: 50, unit: 'batang' },
          { item: 'Tee', size: '1½"', quantity: 4, unit: 'pcs' },
          { item: 'Elbow 90°', size: '1½"', quantity: 4, unit: 'pcs' },
          { item: 'Katup / stop kran', size: '1½"', quantity: 5, unit: 'pcs' },
        ],
      },
    },
  ],
  explain: (input, output) =>
    `Lahan ${input.areaHa} ha ≈ sisi ${Math.round(Math.sqrt(input.areaHa * 10_000))} m → distribusi ±${output.distributionMeters} m (header + lateral tiap ${BRANCH_SPACING_M} m); jalur utama ${input.mainRunMeters} m ${input.mainFamily}; batang PVC ${ROD_METERS} m.`,
};

export const GROUP_E = [ENG_101, ENG_102, ENG_103, ENG_104, ENG_105] as const;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** `sizeTable` opsional di masukan mentah; bawaan inci supaya pemanggil lama tidak berubah. */
export function requireSizeTable(ruleId: string, raw: unknown): SizeTableId {
  if (raw === undefined || raw === 'pvc_inch') return 'pvc_inch';
  if (raw === 'hdpe_mm') return 'hdpe_mm';
  throw new RuleInputError(ruleId, `sizeTable ${String(raw)}`);
}
