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
  vent_cap: { id: 'Topi ventilasi', en: 'Vent cap' },
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
    ventSize: string | undefined,
  ) => {
    if (!size || f === null) return;
    const name =
      system === 'soil' ? { id: 'air kotor', en: 'soil' } : { id: 'air bekas', en: 'waste' };
    needs.push(
      {
        system,
        kind: 'branch_y',
        size,
        // ENG-605 v2: cabang lantai atas masuk pipa tegak lewat Y alatnya sendiri (4g).
        quantity: f.fixtureY,
        purpose: { id: `Y-branch ${name.id}`, en: `${name.en} Y-branches` },
        method: { id: 'Y per alat', en: 'Y per fixture' },
        working: { id: `${f.fixtureY} alat`, en: `${f.fixtureY} fixtures` },
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
    // Ventilasi (review putaran 3, 4f): sambungannya ke jalur dan topinya di atas atap.
    if (ventSize) {
      needs.push(
        {
          system,
          kind: 'branch_y',
          size,
          ...(ventSize !== size ? { branchSize: ventSize } : {}),
          quantity: f.ventJoins,
          purpose: { id: `Sambungan ventilasi ${name.id}`, en: `${name.en} vent joint` },
          method: { id: 'Y/tee pipa ventilasi ke jalur', en: 'Vent Y/tee into the line' },
          working: { id: `${f.ventJoins} per ventilasi`, en: `${f.ventJoins} per vent` },
          ruleId: 'ENG-605',
        },
        {
          system,
          kind: 'vent_cap',
          size: ventSize,
          quantity: f.ventCaps,
          purpose: { id: `Topi ventilasi ${name.id}`, en: `${name.en} vent cap` },
          method: { id: 'Topi di ujung atas ventilasi', en: 'Cap on top of the vent' },
          working: { id: `${f.ventCaps} per ventilasi`, en: `${f.ventCaps} per vent` },
          ruleId: 'ENG-605',
        },
      );
    }
  };
  line('soil', drainage.soil?.size, drainage.fittings.soil, drainage.soil?.ventSize);
  line('waste', drainage.waste?.size, drainage.fittings.waste, drainage.waste?.ventSize);
  return needs.filter((n) => n.quantity > 0);
}

/** Kunci produk per jenis dan ukuran (dipakai pemanggil untuk mencocokkan katalog sekali saja). */
export function fittingKey(need: Pick<FittingNeed, 'kind' | 'size' | 'branchSize'>): string {
  return `${need.kind}|${need.size}|${need.branchSize ?? ''}`;
}

/** Barang yang dibutuhkan tetapi jumlahnya baru dihitung saat pemasangan, per jalur. */
export interface PendingNeed {
  readonly system: BomSystem;
  /** `null` = tidak ada di katalog Pralon (stop kran, lem) — tampil tanpa SKU. */
  readonly kind: FittingKind | null;
  readonly size: string;
  readonly item: Text;
  readonly unit: BomItem['unit'];
  /** Lini Pralon yang belum ada di data katalog — lihat `BomItem.askPralon`. */
  readonly askPralon?: true;
}

/**
 * Dop, stop kran, dan lem (keputusan pemilik 2026-10-13): jumlahnya "dihitung saat pemasangan",
 * tanpa angka karangan, di ukuran jalur utamanya supaya punya SKU; pembuangan mendapat dop dan
 * lem juga (review putaran 3, 4f).
 *
 * Sok TIDAK lagi di sini bila panjang jalurnya dihitung: sejak masukan Leo (2026-10-22) jumlahnya
 * dihitung dari sambungan antar batang (`socketNeeds`). Baris pipa tanpa panjang batang katalog
 * tetap tidak punya sambungan yang bisa dihitung, jadi soknya tetap menyusul.
 */
export function pendingNeeds(
  lines: readonly { readonly system: BomSystem; readonly size: string }[],
  /** Sistem yang soknya sudah dihitung dari sambungan batang — barisnya tidak diulang di sini. */
  socketsCountedFor: readonly BomSystem[] = [],
): readonly PendingNeed[] {
  return lines.flatMap(({ system, size }) => [
    ...(socketsCountedFor.includes(system)
      ? []
      : [
          {
            system,
            kind: 'socket' as const,
            size,
            item: { id: 'Sok', en: 'Socket' },
            unit: 'pcs' as const,
          },
        ]),
    { system, kind: 'cap' as const, size, item: { id: 'Dop', en: 'Cap' }, unit: 'pcs' as const },
    ...(system === 'clean_water'
      ? [
          {
            system,
            kind: null,
            size,
            item: { id: 'Stop kran', en: 'Stop valve' },
            unit: 'pcs' as const,
          },
        ]
      : []),
    {
      system,
      kind: null,
      size: '—',
      item: { id: 'Lem PVC', en: 'PVC solvent cement' },
      unit: 'kaleng' as const,
      // Solvent Cement adalah lini Pralon (materi perusahaan), hanya belum ada di export ERP.
      askPralon: true as const,
    },
  ]);
}

export function pendingRows(
  needs: readonly PendingNeed[],
  locale: Locale,
  productFor: (need: PendingNeed) => string | undefined,
): readonly BomItem[] {
  const en = locale === 'en';
  return needs.map((need) => {
    const productId = productFor(need);
    return {
      item: en ? need.item.en : need.item.id,
      system: need.system,
      size: need.size,
      ...(productId !== undefined ? { productId } : {}),
      quantity: 0,
      unit: need.unit,
      basis: '',
      provenance: 'ASSUMED',
      traceIds: [],
      pending: true,
      ...(need.askPralon ? { askPralon: true as const } : {}),
    };
  });
}

/**
 * Sok sambungan antar batang pipa (masukan Leo 2026-10-22): "pipa sisa itu di asumsikan bisa
 * langsung nyambung ya?, kan butuh socket buat nyambungnya lagi".
 *
 * Jumlahnya dibaca dari baris pipa yang sudah dihitung — tiap baris tahu berapa jalur menerus
 * yang menyusunnya dan berapa panjang batang produknya (`joints`, ENG-015). Baris digabung per
 * sistem dan ukuran, karena satu ukuran dipesan sebagai satu SKU.
 */
export interface SocketNeed {
  readonly system: BomSystem;
  readonly size: string;
  readonly quantity: number;
  /** Rincian per jalur, supaya kolom dasar perhitungan bisa diperiksa. */
  readonly parts: readonly {
    readonly purpose: string;
    readonly runs: number;
    readonly runLengthM: number;
    readonly rodM: number;
    readonly sockets: number;
  }[];
}

export function socketNeeds(rows: readonly BomItem[]): readonly SocketNeed[] {
  const bySize = new Map<string, SocketNeed>();
  for (const row of rows) {
    if (row.joints === undefined || row.rod === undefined || row.joints.sockets <= 0) continue;
    const system = row.system ?? 'clean_water';
    const key = `${system}|${row.size}`;
    const found = bySize.get(key) ?? { system, size: row.size, quantity: 0, parts: [] };
    bySize.set(key, {
      ...found,
      quantity: found.quantity + row.joints.sockets,
      parts: [
        ...found.parts,
        {
          purpose: row.purpose ?? row.item,
          runs: row.joints.runs,
          runLengthM: row.joints.runLengthM,
          rodM: row.rod.meters,
          sockets: row.joints.sockets,
        },
      ],
    });
  }
  return [...bySize.values()];
}

export function socketRows(
  needs: readonly SocketNeed[],
  locale: Locale,
  productFor: (need: SocketNeed) => string | undefined,
): readonly BomItem[] {
  const en = locale === 'en';
  const n = (value: number) => value.toLocaleString(en ? 'en-US' : 'id-ID');
  return needs.map((need) => {
    const productId = productFor(need);
    const working = need.parts
      .map(
        (part) =>
          `${part.purpose}: (⌈${n(part.runLengthM)} ÷ ${n(part.rodM)}⌉ − 1) × ${n(part.runs)} = ${n(part.sockets)}`,
      )
      .join('; ');
    return {
      item: en ? 'Socket' : 'Sok',
      system: need.system,
      purpose: en ? 'Joining pipe rods' : 'Sambungan antar batang',
      size: need.size,
      ...(productId !== undefined ? { productId } : {}),
      quantity: need.quantity,
      unit: 'pcs' as const,
      basis: en
        ? `Rods joined end to end need one socket per joint. ${working} = ${n(need.quantity)} pcs. Fittings on the route (elbows, tees) have their own sockets and are not counted again; on site the number can be lower when an offcut lands at a fitting.`
        : `Batang yang disambung ujung ke ujung butuh satu sok tiap sambungan. ${working} = ${n(need.quantity)} pcs. Fitting di jalur (elbow, tee) punya sambungannya sendiri dan tidak dihitung lagi; di lapangan jumlahnya bisa lebih sedikit kalau potongan pipa jatuh pas di fitting.`,
      calc: {
        method: en
          ? 'One socket per joint between rods'
          : 'Satu sok tiap sambungan antar batang pipa',
        working,
        result: `${n(need.quantity)} pcs`,
      },
      provenance: 'ASSUMED' as const,
      traceIds: [],
    };
  });
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
