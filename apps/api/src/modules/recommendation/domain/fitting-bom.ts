/**
 * Baris BOQ fitting (P18-01, keputusan pemilik 2026-10-13): hasil ENG-708 (air bersih) dan ENG-605
 * (pembuangan) menjadi baris material dengan dasar perhitungannya. Jumlahnya dari engine — modul
 * ini hanya menata; produk Pralon per jenis dan ukuran dipilih pemanggil lewat `productFor`.
 * Ukuran yang tidak ada di katalog tetap jadi baris berjumlah, tanpa nama produk (tidak dikarang).
 */

import type { HouseDrainageResult, SolutionResult } from '@snouty/engineering';
import { PipeSize, type BomItem, type BomSystem, type Locale } from '@snouty/shared-types';
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
  readonly ruleId: 'ENG-708' | 'ENG-605' | 'ENG-715';
}

const ITEM: Readonly<Partial<Record<FittingKind, Text>>> = {
  elbow: { id: 'Elbow', en: 'Elbow' },
  elbow_45: { id: 'Elbow 45°', en: '45° elbow' },
  faucet_elbow: { id: 'Faucet elbow', en: 'Faucet elbow' },
  branch_y: { id: 'Y-branch', en: 'Y-branch' },
  clean_out: { id: 'Clean out', en: 'Clean-out' },
  reducer: { id: 'Reducer cabang', en: 'Branch reducer' },
  cap: { id: 'Dop', en: 'Cap' },
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
  // Dop penutup ujung mati jalur (ENG-715, keputusan pemilik 2026-11-24): per ukuran, karena satu
  // ukuran dipesan sebagai satu SKU. Sampai 24 Nov 2026 barisnya tercetak tanpa angka.
  for (const cap of solution.closures.caps) {
    needs.push({
      system: 'clean_water',
      kind: 'cap',
      size: cap.size,
      quantity: cap.count,
      purpose: { id: 'Dop ujung jalur', en: 'Cap at the end of a run' },
      method: { id: 'Satu dop per ujung mati jalur', en: 'One cap per blind end of a run' },
      working: {
        id: `${cap.count} ujung mati ${cap.size}`,
        en: `${cap.count} blind ends of ${cap.size}`,
      },
      ruleId: 'ENG-715',
    });
  }
  return needs.filter((n) => n.quantity > 0);
}

/**
 * Stop kran (ENG-715, keputusan pemilik 2026-11-24): dihitung, tetapi tidak ada di katalog Pralon,
 * jadi barisnya punya angka tanpa SKU — bukan baris tanpa angka seperti sebelumnya.
 */
export function stopValveRow(
  solution: SolutionResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale,
): BomItem {
  const en = locale === 'en';
  const quantity = solution.closures.stopValves;
  const ids = traceIdsFor(traces, 'ENG-715');
  const method = en
    ? 'One on the main after the source, plus one per floor above the first'
    : 'Satu di pipa utama setelah sumber, ditambah satu per lantai di atas lantai satu';
  const floors = solution.floorsPlan.length;
  const working = en ? `${floors} floors` : `${floors} lantai`;
  return {
    item: en ? 'Stop valve' : 'Stop kran',
    system: 'clean_water',
    // Peruntukan ikut menyebut barangnya: baris tanpa SKU hanya menampilkan peruntukan di BOQ,
    // jadi tanpa namanya pembaca tidak tahu apa yang harus dibeli.
    purpose: en ? 'Stop valve for the house and each floor' : 'Stop kran rumah dan tiap lantai',
    size: solution.mainSize,
    quantity,
    unit: 'pcs',
    basis: `${method}: ${working} = ${quantity} pcs.`,
    calc: { method, working, result: `${quantity} pcs` },
    provenance: provenanceFor(traces, ids),
    traceIds: ids,
  };
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

/**
 * Bak kontrol (ENG-607, keputusan pemilik 2026-11-24): dihitung, tetapi pekerjaan pasangan di
 * lapangan — bukan barang katalog Pralon, jadi barisnya berjumlah tanpa SKU. `null` bila panjang
 * jalurnya belum diketahui: di situ tidak ada baris sama sekali, bukan baris tanpa angka.
 */
export function inspectionChamberRows(
  drainage: HouseDrainageResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale,
): readonly BomItem[] {
  const chambers = drainage.inspectionChambers;
  if (chambers === null) return [];
  const en = locale === 'en';
  const ids = traceIdsFor(traces, 'ENG-607');
  const row = (system: 'soil' | 'waste', quantity: number | null): BomItem | null => {
    if (quantity === null || quantity === 0) return null;
    const name =
      system === 'soil' ? { id: 'air kotor', en: 'soil' } : { id: 'air bekas', en: 'waste' };
    const method = en
      ? 'One at the stack foot, then one every 10 m of horizontal run'
      : 'Satu di kaki pipa tegak, lalu satu setiap 10 m jalur mendatar';
    const working = en ? `${quantity} chambers` : `${quantity} bak`;
    return {
      item: en ? 'Inspection chamber' : 'Bak kontrol',
      system,
      // Namanya ikut di peruntukan: baris ini tanpa SKU, dan di BOQ yang tampil peruntukannya.
      purpose: en ? `Inspection chamber on the ${name.en} line` : `Bak kontrol jalur ${name.id}`,
      size: '—',
      quantity,
      unit: 'pcs',
      basis: `${method}: ${working}.`,
      calc: { method, working, result: working },
      provenance: provenanceFor(traces, ids),
      traceIds: ids,
    };
  };
  return [row('soil', chambers.soil), row('waste', chambers.waste)].filter(
    (item): item is BomItem => item !== null,
  );
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
/** Batas dua jenis solvent cement Pralon: sampai 3" quick dry, di atasnya slow dry. */
const QUICK_DRY_MAX = PipeSize.parse('3"')!;

/**
 * Jenis solvent cement yang dipakai jalur seukuran ini (masukan sales Pralon 2026-11-03: "bisa
 * dimasukin saran penggunaan Solvent cement Pralon berdasarkan ukuran pipa … yang ada di simulasi
 * AI nya"). Quick dry 1/2"–3", slow dry 4"–12" — sambungan besar perlu waktu lebih lama untuk
 * diluruskan dan ditahan. Ukuran yang tidak terbaca, atau yang bukan inci, tetap "Lem PVC" tanpa
 * jenis: menebak jenisnya sama saja mengarang.
 */
export function solventCement(size: string): Text {
  const parsed = PipeSize.parse(size);
  if (parsed === null || parsed.unit !== 'in') return { id: 'Lem PVC', en: 'PVC solvent cement' };
  return parsed.isLargerThan(QUICK_DRY_MAX)
    ? { id: 'Lem PVC slow dry', en: 'PVC solvent cement (slow dry)' }
    : { id: 'Lem PVC quick dry', en: 'PVC solvent cement (quick dry)' };
}

/** Nama barisnya dalam bahasa balasan. */
export function solventCementLabel(size: string, locale: Locale): string {
  const item = solventCement(size);
  return locale === 'en' ? item.en : item.id;
}

export function pendingNeeds(
  lines: readonly { readonly system: BomSystem; readonly size: string }[],
  /** Sistem yang soknya sudah dihitung dari sambungan batang — barisnya tidak diulang di sini. */
  socketsCountedFor: readonly BomSystem[] = [],
  /**
   * Sistem yang dop dan stop krannya sudah dihitung (ENG-715, air bersih): barisnya tidak diulang
   * tanpa angka di sini. Jalur pembuangan belum punya aturan ujung matinya, jadi dop-nya tetap
   * menyusul (OQ-98).
   */
  closuresCountedFor: readonly BomSystem[] = [],
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
    ...(closuresCountedFor.includes(system)
      ? []
      : [
          {
            system,
            kind: 'cap' as const,
            size,
            item: { id: 'Dop', en: 'Cap' },
            unit: 'pcs' as const,
          },
        ]),
    ...(system === 'clean_water' && !closuresCountedFor.includes(system)
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
      item: solventCement(size),
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
