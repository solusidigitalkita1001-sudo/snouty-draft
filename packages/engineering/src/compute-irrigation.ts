/**
 * Orkestrator irigasi (OQ-47): satu panggilan, satu trace per aturan — kembaran
 * `computeSolution` untuk guna irigasi. Murni, tanpa I/O.
 *
 * Seluruh aturan Kelompok E `REQUIRES_DOMAIN_VALIDATION`, jadi `overallProvenance` selalu
 * `ASSUMED` sampai tim teknis Pralon menandatanganinya. Itu disengaja: hasilnya adalah
 * perkiraan awal yang bisa dijelaskan baris per baris, bukan desain final.
 */

import { assumption } from './parameters/assumptions.js';
import { sizeTableFor } from './parameters/size-tables.js';
import { gateEngineProvenance, type Provenance } from './provenance.js';
import type { CalculationTrace } from './compute-solution.js';
import type { RuleVersion } from './rule.js';
import {
  ENG_101,
  ENG_102,
  ENG_103,
  ENG_104,
  ENG_105,
  type IrrigationBomLine,
  type IrrigationMethod,
  type SourceElevation,
} from './rules/group-e-irrigation.js';

export interface IrrigationInput {
  readonly areaHa: number;
  readonly method: IrrigationMethod;
  /** Jarak sumber air ke lahan, meter (titik tengah rentang bila dari pilihan). */
  readonly mainRunMeters: number;
  readonly elevation: SourceElevation;
  /** Kecepatan aliran rencana; bawaan 1,5 m/s (ENG-102). */
  readonly velocityMs?: number;
}

export interface IrrigationResult {
  readonly designFlowLs: number;
  readonly mainSize: string;
  /** Ukuran distribusi PVC AW di lahan (inci); sama dengan `mainSize` bila jalur utama PVC. */
  readonly distributionSize: string;
  readonly innerDiameterMm: number;
  readonly pumpRequired: boolean;
  readonly pressureClass: 'AW' | 'D';
  readonly mainFamily: 'HDPE' | 'PVC AW';
  readonly distributionFamily: 'PVC AW';
  readonly distributionMeters: number;
  readonly bom: readonly IrrigationBomLine[];
  readonly traces: readonly CalculationTrace[];
  readonly overallProvenance: Provenance;
}

const DEFAULT_VELOCITY_MS = assumption('DESIGN_VELOCITY_PLASTIC').value as number;

export function computeIrrigation(input: IrrigationInput): IrrigationResult {
  const traces: CalculationTrace[] = [];

  function run<I, O>(rule: RuleVersion<I, O>, raw: unknown): O {
    const parsed = rule.parseInput(raw);
    const output = rule.compute(parsed);
    traces.push({
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
      inputs: parsed,
      output,
      // Jarak dari pilihan rentang bukan dimensi nyata → tidak pernah VERIFIED di sini.
      provenance: gateEngineProvenance({
        ruleStatus: rule.validationStatus,
        hasRealDimensions: false,
      }),
      explanation: rule.explain(parsed, output),
    });
    return output;
  }

  const flow = run(ENG_101, { areaHa: input.areaHa, method: input.method });
  // Bahan dulu: tabel ukuran jalur utama ikut bahannya (HDPE dalam mm, PVC dalam inci).
  const material = run(ENG_104, { mainRunMeters: input.mainRunMeters });
  const velocityMs = input.velocityMs ?? DEFAULT_VELOCITY_MS;
  const main = run(ENG_102, {
    designFlowLs: flow.designFlowLs,
    velocityMs,
    sizeTable: sizeTableFor(material.mainFamily),
  });
  // Distribusi di lahan selalu PVC AW (inci); satu trace lagi hanya bila tabelnya berbeda.
  const distribution =
    sizeTableFor(material.mainFamily) === 'pvc_inch'
      ? main
      : run(ENG_102, { designFlowLs: flow.designFlowLs, velocityMs, sizeTable: 'pvc_inch' });
  const pressure = run(ENG_103, { method: input.method, elevation: input.elevation });
  const bom = run(ENG_105, {
    areaHa: input.areaHa,
    mainRunMeters: input.mainRunMeters,
    mainSize: main.mainSize,
    distributionSize: distribution.mainSize,
    mainFamily: material.mainFamily,
  });

  return {
    designFlowLs: flow.designFlowLs,
    mainSize: main.mainSize,
    distributionSize: distribution.mainSize,
    innerDiameterMm: main.innerDiameterMm,
    pumpRequired: pressure.pumpRequired,
    pressureClass: pressure.pressureClass,
    mainFamily: material.mainFamily,
    distributionFamily: material.distributionFamily,
    distributionMeters: bom.distributionMeters,
    bom: bom.lines,
    traces,
    overallProvenance: traces.some((t) => t.provenance !== 'VERIFIED') ? 'ASSUMED' : 'VERIFIED',
  };
}
