/**
 * Baris BOQ fitting (P18-01, keputusan pemilik 2026-10-13): hasil ENG-708 (air bersih) dan ENG-605
 * (pembuangan) menjadi baris material dengan dasar perhitungannya. Jumlahnya dari engine — modul
 * ini hanya menata; produk Pralon per jenis dan ukuran dipilih pemanggil lewat `productFor`.
 * Ukuran yang tidak ada di katalog tetap jadi baris berjumlah, tanpa nama produk (tidak dikarang).
 */

import type { HouseDrainageResult, SolutionResult } from '@snouty/engineering';
import type { BomItem, BomSystem, Locale } from '@snouty/shared-types';
import type { FittingKind } from '../../product-catalog/domain/product-types.js';
import { provenanceFor, traceIdsFor, type IdentifiedTrace } from './solution-view.js';

type Text = { readonly id: string; readonly en: string };

export interface FittingNeed {
  readonly system: BomSystem;
  readonly kind: FittingKind;
  readonly size: string;
  /** Sisi kedua fitting reduksi (reducer pipa utama → cabang). */
  readonly branchSize?: string;
  readonly quantity: number;
  readonly purpose: Text;
  /** Cara hitung dan hitungannya — kolom tabel dasar perhitungan. */
  readonly method: Text;
  readonly working: Text;
  readonly ruleId: 'ENG-708' | 'ENG-605';
}

const ITEM: Readonly<Partial<Record<FittingKind, Text>>> = {
  elbow: { id: 'Elbow', en: 'Elbow' },
  elbow_45: { id: 'Elbow 45°', en: '45° elbow' },
  faucet_elbow: { id: 'Faucet elbow', en: 'Faucet elbow' },
  branch_y: { id: 'Y-branch', en: 'Y-branch' },
  clean_out: { id: 'Clean out', en: 'Clean-out' },
  reducer: { id: 'Reducer cabang', en: 'Branch reducer' },
};

/** Fitting air bersih dari ENG-708. */
export function supplyFittingNeeds(solution: SolutionResult): readonly FittingNeed[] {
  const f = solution.fittings;
  const needs: FittingNeed[] = [
    {
      system: 'clean_water',
      kind: 'elbow',
      size: solution.mainSize,
      quantity: f.mainElbows,
      purpose: { id: 'Elbow pipa utama', en: 'Main line elbows' },
      method: { id: 'Elbow di pipa utama', en: 'Elbows on the main' },
      working: { id: `${f.mainElbows} per pipa utama`, en: `${f.mainElbows} per main` },
      ruleId: 'ENG-708',
    },
  ];
  // Ujung pipa utama: elbow ke cabang terakhir, dengan reducer bila cabangnya lebih kecil (v2).
  if (f.endElbows > 0) {
    needs.push({
      system: 'clean_water',
      kind: 'elbow',
      size: solution.mainSize,
      quantity: f.endElbows,
      purpose: { id: 'Elbow ujung pipa utama', en: 'Main end elbow' },
      method: { id: 'Elbow di ujung pipa utama', en: 'Elbow at the end of the main' },
      working: { id: '1 per pipa utama', en: '1 per main' },
      ruleId: 'ENG-708',
    });
  }
  if (f.endReducer !== null) {
    needs.push({
      system: 'clean_water',
      kind: 'reducer',
      size: solution.mainSize,
      branchSize: f.endReducer,
      quantity: 1,
      purpose: { id: 'Reducer ujung pipa utama', en: 'Main end reducer' },
      method: {
        id: `Pipa utama ${solution.mainSize} ke cabang terakhir ${f.endReducer}`,
        en: `Main ${solution.mainSize} to the last branch ${f.endReducer}`,
      },
      working: { id: '1 per pipa utama', en: '1 per main' },
      ruleId: 'ENG-708',
    });
  }
  if (solution.tankFill !== null && f.tankFillElbows > 0) {
    needs.push({
      system: 'clean_water',
      kind: 'elbow',
      size: solution.tankFill.size,
      quantity: f.tankFillElbows,
      purpose: { id: 'Elbow pengisi toren', en: 'Tank fill elbows' },
      method: { id: 'Elbow di pipa pengisi toren', en: 'Elbows on the tank fill' },
      working: {
        id: `${f.tankFillElbows} per pipa pengisi`,
        en: `${f.tankFillElbows} per fill pipe`,
      },
      ruleId: 'ENG-708',
    });
  }
  for (const branch of f.branchElbows) {
    const group = solution.branchGroups.find((g) => g.size === branch.size);
    needs.push({
      system: 'clean_water',
      kind: 'elbow',
      size: branch.size,
      quantity: branch.count,
      purpose: { id: 'Elbow cabang', en: 'Branch elbows' },
      method: { id: 'Elbow per cabang', en: 'Elbows per branch' },
      working: {
        id: `${group?.count ?? branch.count} cabang ${branch.size}`,
        en: `${group?.count ?? branch.count} branches of ${branch.size}`,
      },
      ruleId: 'ENG-708',
    });
  }
  needs.push(
    {
      system: 'clean_water',
      kind: 'elbow',
      size: solution.fixtureConnectionSize,
      quantity: f.outletElbows,
      purpose: { id: 'Elbow ke alat', en: 'Fixture elbows' },
      method: { id: 'Elbow per titik air', en: 'Elbows per outlet' },
      working: { id: `${solution.outletCount} titik air`, en: `${solution.outletCount} outlets` },
      ruleId: 'ENG-708',
    },
    {
      system: 'clean_water',
      kind: 'faucet_elbow',
      size: solution.fixtureConnectionSize,
      quantity: f.faucetElbows,
      purpose: { id: 'Drat kran', en: 'Tap threads' },
      method: { id: 'Faucet elbow per titik air', en: 'Faucet elbows per outlet' },
      working: { id: `${solution.outletCount} titik air`, en: `${solution.outletCount} outlets` },
      ruleId: 'ENG-708',
    },
  );
  return needs.filter((n) => n.quantity > 0);
}

/** Fitting pembuangan dari ENG-605, per jalur di ukuran jalurnya. */
export function drainFittingNeeds(drainage: HouseDrainageResult): readonly FittingNeed[] {
  const needs: FittingNeed[] = [];
  const line = (
    system: 'soil' | 'waste',
    size: string | undefined,
    f: HouseDrainageResult['fittings']['soil'],
  ) => {
    if (!size || f === null) return;
    const name =
      system === 'soil' ? { id: 'air kotor', en: 'soil' } : { id: 'air bekas', en: 'waste' };
    needs.push(
      {
        system,
        kind: 'branch_y',
        size,
        quantity: f.fixtureY + f.stackY,
        purpose: { id: `Y-branch ${name.id}`, en: `${name.en} Y-branches` },
        method: {
          id: 'Y per alat + Y per lantai atas di pipa tegak',
          en: 'Y per fixture + Y per upper floor on the stack',
        },
        working: { id: `${f.fixtureY} + ${f.stackY}`, en: `${f.fixtureY} + ${f.stackY}` },
        ruleId: 'ENG-605',
      },
      {
        system,
        kind: 'elbow_45',
        size,
        quantity: f.elbows45,
        purpose: { id: `Elbow 45° kaki pipa ${name.id}`, en: `${name.en} stack foot 45° elbows` },
        method: { id: 'Elbow 45° di kaki pipa tegak', en: '45° elbows at the stack foot' },
        working: { id: `${f.elbows45} per pipa tegak`, en: `${f.elbows45} per stack` },
        ruleId: 'ENG-605',
      },
      {
        system,
        kind: 'clean_out',
        size,
        quantity: f.cleanouts,
        purpose: { id: `Clean out ${name.id}`, en: `${name.en} clean-out` },
        method: { id: 'Clean out per jalur', en: 'Clean-outs per line' },
        working: { id: `${f.cleanouts} per jalur`, en: `${f.cleanouts} per line` },
        ruleId: 'ENG-605',
      },
    );
  };
  line('soil', drainage.soil?.size, drainage.fittings.soil);
  line('waste', drainage.waste?.size, drainage.fittings.waste);
  return needs.filter((n) => n.quantity > 0);
}

/** Kunci produk per jenis dan ukuran (dipakai pemanggil untuk mencocokkan katalog sekali saja). */
export function fittingKey(need: Pick<FittingNeed, 'kind' | 'size' | 'branchSize'>): string {
  return `${need.kind}|${need.size}|${need.branchSize ?? ''}`;
}

export function fittingBomRows(
  needs: readonly FittingNeed[],
  traces: readonly IdentifiedTrace[],
  locale: Locale,
  productFor: (need: FittingNeed) => string | undefined,
): readonly BomItem[] {
  const en = locale === 'en';
  return needs.map((need) => {
    const ids = traceIdsFor(traces, need.ruleId);
    const productId = productFor(need);
    const text = (t: Text) => (en ? t.en : t.id);
    return {
      item: text(ITEM[need.kind] ?? { id: 'Fitting', en: 'Fitting' }),
      system: need.system,
      purpose: text(need.purpose),
      size: need.branchSize ? `${need.size} × ${need.branchSize}` : need.size,
      ...(productId !== undefined ? { productId } : {}),
      quantity: need.quantity,
      unit: 'pcs',
      basis: `${text(need.method)}: ${text(need.working)} = ${need.quantity} pcs.`,
      calc: {
        method: text(need.method),
        working: text(need.working),
        result: `${need.quantity} pcs`,
      },
      provenance: provenanceFor(traces, ids),
      traceIds: ids,
    };
  });
}
