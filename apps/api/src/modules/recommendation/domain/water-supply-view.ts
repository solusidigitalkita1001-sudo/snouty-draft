/**
 * Tampilan jaringan air minum (audit PDAM 2026-10-16): per segmen (induk, cabang), mode sistem,
 * pompa sebesar kekurangan, kelas tekanan dengan surja, dan BOM yang jujur — tee per cabang dari
 * topologi, fitting lain tertunda "dihitung saat pemasangan". Angka hanya dari `NetworkResult`.
 */
import type { NetworkResult, WaterSupplyPlan } from '@snouty/engineering';
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import type { BomItem, KeyValue, SystemLine } from '@snouty/shared-types';
import type { IdentifiedTrace } from './solution-view.js';
import type { Provenance } from '@snouty/shared-types';
import { pipePurchase, type StockLength } from './pipe-quantity.js';

function traceIdsFor(traces: readonly IdentifiedTrace[], ...ruleIds: string[]): readonly string[] {
  return traces.filter((t) => ruleIds.includes(t.ruleId)).map((t) => t.id);
}
function explanationFor(traces: readonly IdentifiedTrace[], ruleId: string): string {
  return traces.find((t) => t.ruleId === ruleId)?.explanation ?? '';
}
function provenanceFor(traces: readonly IdentifiedTrace[], ids: readonly string[]): Provenance {
  const own = traces.filter((t) => ids.includes(t.id)).map((t) => t.provenance);
  if (own.includes('UNAVAILABLE')) return 'UNAVAILABLE';
  if (own.includes('ASSUMED')) return 'ASSUMED';
  if (own.includes('ESTIMATED')) return 'ESTIMATED';
  return own.length > 0 ? 'VERIFIED' : 'ASSUMED';
}

const id = (n: number, locale: Locale = DEFAULT_LOCALE): string =>
  locale === 'en'
    ? n.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false })
    : String(n).replace('.', ',');

export function supplyModeLabel(mode: WaterSupplyPlan['mode']['kind'], locale: Locale): string {
  const en = locale === 'en';
  switch (mode) {
    case 'gravity':
      return en ? 'Gravity from the reservoir' : 'Gravitasi dari reservoir';
    case 'direct_supply':
      return en ? 'Direct mains supply, no pump' : 'Suplai langsung PDAM, tanpa pompa';
    case 'booster':
      return en ? 'Mains + booster pump' : 'PDAM + pompa booster';
    default:
      return en ? 'Pumped from the source' : 'Dipompa dari sumber';
  }
}

/** Highlight jaringan air minum — menggantikan highlight bertekanan generik. */
export function waterSupplyHighlights(
  result: NetworkResult,
  family: string,
  productCount: number,
  locale: Locale = DEFAULT_LOCALE,
): readonly KeyValue[] {
  const sp = result.supply!;
  const en = locale === 'en';
  const t = sp.topology;
  const rows: KeyValue[] = [
    { label: en ? 'House connections' : 'Sambungan rumah', value: `${result.connections} SR` },
    {
      label: en ? 'Peak hour' : 'Jam puncak',
      value: en
        ? `${id(sp.peakHourLs, locale)} l/s (average ${id(sp.averageLs, locale)} l/s)`
        : `${id(sp.peakHourLs)} l/s (rata-rata ${id(sp.averageLs)} l/s)`,
    },
    {
      label: en ? 'Maximum day' : 'Hari maksimum',
      value: en
        ? `${id(sp.maxDayLs, locale)} l/s (${id(sp.dailyVolumeM3, locale)} m³/day average)`
        : `${id(sp.maxDayLs)} l/s (${id(sp.dailyVolumeM3)} m³/hari rata-rata)`,
    },
    { label: en ? 'Reservoir' : 'Reservoir', value: `${id(sp.reservoirM3, locale)} m³` },
    {
      label: en ? 'Trunk main' : 'Pipa induk',
      value: `${family} ${t.trunk.size} · ${id(t.trunk.velocityMs, locale)} m/s · ${id(t.trunk.frictionLossM, locale)} m`,
    },
  ];
  if (t.branch) {
    rows.push({
      label: en ? `Branches (${t.branches})` : `Cabang (${t.branches})`,
      value: `${family} ${t.branch.size} · ${id(t.branch.flowLs, locale)} l/s ${en ? 'each' : 'tiap cabang'} · ${id(t.branch.lengthM, locale)} m`,
    });
  } else {
    rows.push({
      label: en ? 'Branches' : 'Cabang',
      value: en ? 'Not given — single pipe assumed' : 'Belum disebut — dihitung satu pipa (asumsi)',
    });
  }
  rows.push({
    label: en ? 'Head at the critical point' : 'Head di titik kritis',
    value: en
      ? `${id(sp.criticalPath.requiredHeadM, locale)} m (losses ${id(sp.criticalPath.lossM, locale)} m)`
      : `${id(sp.criticalPath.requiredHeadM)} m (kehilangan ${id(sp.criticalPath.lossM)} m)`,
  });
  rows.push({ label: en ? 'System' : 'Sistem', value: supplyModeLabel(sp.mode.kind, locale) });
  rows.push({
    label: en ? 'Pump' : 'Pompa',
    value: result.pumpDuty
      ? `${id(result.pumpDuty.flowM3h, locale)} ${en ? 'm³/h' : 'm³/jam'} @ ${id(sp.mode.pumpHeadM, locale)} m${en ? ' — match to the maker’s curve' : ' — cocokkan dengan kurva pabrikan'}`
      : en
        ? `None — ${id(sp.mode.residualAtCriticalBar, locale)} bar left at the critical point`
        : `Tidak perlu — sisa ${id(sp.mode.residualAtCriticalBar)} bar di titik kritis`,
  });
  rows.push({
    label: en ? 'Pressure class' : 'Kelas tekanan',
    value:
      sp.pressureClass.pn === null
        ? en
          ? `${id(sp.maxPressureBar, locale)} bar + surge ${id(sp.surgeBar, locale)} bar — technical review`
          : `${id(sp.maxPressureBar)} bar + surja ${id(sp.surgeBar)} bar — kajian tim teknis`
        : `PN ${id(sp.pressureClass.pn, locale)} (${id(sp.maxPressureBar, locale)} bar${sp.surgeBar > 0 ? ` + ${en ? 'surge' : 'surja'} ${id(sp.surgeBar, locale)} bar` : ''})`,
  });
  rows.push({ label: en ? 'Pralon products' : 'Produk Pralon', value: `${productCount} item` });
  return rows;
}

export function waterSupplySystemLines(
  result: NetworkResult,
  family: string,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
): readonly SystemLine[] {
  const sp = result.supply!;
  const en = locale === 'en';
  const t = sp.topology;
  const trunkIds = traceIdsFor(traces, 'ENG-414', 'ENG-205', 'ENG-201', 'ENG-202');
  const headIds = traceIdsFor(traces, 'ENG-415', 'ENG-416', 'ENG-206');
  const classIds = traceIdsFor(traces, 'ENG-411');
  const lines: SystemLine[] = [
    {
      name: en ? `${family} trunk main` : `Pipa induk ${family}`,
      path: en ? 'Source → first branch' : 'Sumber → cabang pertama',
      size: t.trunk.size,
      reason: `${explanationFor(traces, 'ENG-414')} ${explanationFor(traces, 'ENG-205')}`.trim(),
      provenance: provenanceFor(traces, trunkIds),
      traceIds: trunkIds,
      role: 'main',
    },
  ];
  if (t.branch) {
    lines.push({
      name: en ? `${family} branch (× ${t.branches})` : `Pipa cabang ${family} (× ${t.branches})`,
      path: en ? 'Trunk → house connections' : 'Pipa induk → sambungan rumah',
      size: t.branch.size,
      reason: en
        ? `Each branch carries ${id(t.branch.flowLs, locale)} l/s over ${id(t.branch.lengthM, locale)} m at ${id(t.branch.velocityMs, locale)} m/s, friction loss ${id(t.branch.frictionLossM, locale)} m.`
        : `Tiap cabang membawa ${id(t.branch.flowLs)} l/s sepanjang ${id(t.branch.lengthM)} m pada ${id(t.branch.velocityMs)} m/s, kerugian gesek ${id(t.branch.frictionLossM)} m.`,
      provenance: provenanceFor(traces, trunkIds),
      traceIds: trunkIds,
      role: 'branch',
    });
  }
  lines.push({
    name: supplyModeLabel(sp.mode.kind, locale),
    path: en ? 'Source → critical point' : 'Sumber → titik kritis',
    size: result.pumpDuty
      ? `${id(result.pumpDuty.flowM3h, locale)} ${en ? 'm³/h' : 'm³/jam'} @ ${id(sp.mode.pumpHeadM, locale)} m`
      : `${id(sp.mode.residualAtCriticalBar, locale)} bar ${en ? 'left' : 'sisa'}`,
    reason:
      `${explanationFor(traces, 'ENG-415')} ${explanationFor(traces, 'ENG-416')} ${explanationFor(traces, 'ENG-206')}`.trim(),
    provenance: provenanceFor(traces, headIds),
    traceIds: headIds,
    role: 'fitting',
  });
  lines.push({
    name: en ? 'Pressure class' : 'Kelas tekanan',
    path: en ? 'Whole network' : 'Seluruh jaringan',
    size: sp.pressureClass.pn === null ? '-' : `PN ${id(sp.pressureClass.pn, locale)}`,
    reason: explanationFor(traces, 'ENG-411'),
    provenance: provenanceFor(traces, classIds),
    traceIds: classIds,
    role: 'fitting',
  });
  return lines;
}

/**
 * BOM: pipa induk, pipa cabang (N × panjang), tee per cabang dan reducer bila ukurannya beda,
 * lalu fitting yang tidak bisa dihitung tanpa denah sebagai baris tertunda.
 */
export function waterSupplyBomItems(
  result: NetworkResult,
  family: string,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
  stock: { readonly trunk: StockLength | null; readonly branch: StockLength | null },
  productIds: { readonly tee?: string; readonly reducer?: string } = {},
): readonly BomItem[] {
  const sp = result.supply!;
  const en = locale === 'en';
  const t = sp.topology;
  const ids = traceIdsFor(traces, 'ENG-414', 'ENG-205');
  const provenance = provenanceFor(traces, ids);
  const trunkPipe = pipePurchase(
    t.trunk.lengthM,
    en ? `trunk ${t.trunk.lengthM} m` : `induk ${t.trunk.lengthM} m`,
    stock.trunk,
    locale,
  );
  const lines: BomItem[] = [
    {
      item: en ? `${family} pipe (trunk)` : `Pipa ${family} (induk)`,
      size: t.trunk.size,
      quantity: trunkPipe.quantity,
      unit: trunkPipe.unit,
      basis: `${explanationFor(traces, 'ENG-414')} ${trunkPipe.basis}`.trim(),
      provenance,
      traceIds: ids,
      ...(trunkPipe.productId ? { productId: trunkPipe.productId } : {}),
    },
  ];
  if (t.branch) {
    const total = t.branch.lengthM * t.branches;
    const branchPipe = pipePurchase(
      total,
      en
        ? `${t.branches} branches × ${t.branch.lengthM} m`
        : `${t.branches} cabang × ${t.branch.lengthM} m`,
      stock.branch,
      locale,
    );
    lines.push({
      item: en ? `${family} pipe (branches)` : `Pipa ${family} (cabang)`,
      size: t.branch.size,
      quantity: branchPipe.quantity,
      unit: branchPipe.unit,
      basis: `${explanationFor(traces, 'ENG-414')} ${branchPipe.basis}`.trim(),
      provenance,
      traceIds: ids,
      ...(branchPipe.productId ? { productId: branchPipe.productId } : {}),
    });
    lines.push({
      item: en ? 'Tee (branch take-off)' : 'Tee (percabangan)',
      size: t.branch.size === t.trunk.size ? t.trunk.size : `${t.trunk.size} × ${t.branch.size}`,
      quantity: t.branches,
      unit: 'pcs',
      basis: en ? 'One tee per branch from the topology.' : 'Satu tee per cabang dari topologi.',
      provenance,
      traceIds: ids,
      ...(productIds.tee ? { productId: productIds.tee } : {}),
    });
    if (t.branch.size !== t.trunk.size) {
      lines.push({
        item: en ? 'Reducer (trunk → branch)' : 'Reducer (induk → cabang)',
        size: `${t.trunk.size} × ${t.branch.size}`,
        quantity: t.branches,
        unit: 'pcs',
        basis: en
          ? 'One reducer per branch where the size steps down.'
          : 'Satu reducer per cabang karena ukurannya turun.',
        provenance,
        traceIds: ids,
        ...(productIds.reducer ? { productId: productIds.reducer } : {}),
      });
    }
  }
  // Tanpa denah jalur, jumlah belokan dan katup tidak dihitung — ditulis, bukan dikarang.
  const pending = (item: { id: string; en: string }, size: string): BomItem => ({
    item: en ? item.en : item.id,
    size,
    quantity: 0,
    unit: 'pcs',
    basis: '',
    provenance: 'ASSUMED',
    traceIds: [],
    pending: true,
  });
  lines.push(
    pending({ id: 'Elbow 90° (belokan jalur)', en: 'Elbow 90° (route bends)' }, t.trunk.size),
  );
  lines.push(
    pending(
      { id: 'Katup / gate valve (sumber, cabang)', en: 'Gate valve (source, branches)' },
      t.trunk.size,
    ),
  );
  if (result.pumpDuty) {
    lines.push(
      pending(
        { id: 'Katup searah dan adaptor pompa', en: 'Check valve and pump adaptors' },
        t.trunk.size,
      ),
    );
  }
  return lines;
}

/** Huruf pertama kecil untuk sambungan kalimat, singkatan seperti PDAM tetap utuh. */
function lowerFirst(label: string): string {
  const [first = '', second = ''] = label;
  return second === second.toUpperCase() && /[A-Z]/.test(second)
    ? label
    : first.toLowerCase() + label.slice(1);
}

/** Prosa jaringan air minum: mode, segmen, dan apa yang belum final. */
export function waterSupplyProse(
  result: NetworkResult,
  family: string,
  locale: Locale = DEFAULT_LOCALE,
): { headline: string; body: string } {
  const sp = result.supply!;
  const t = sp.topology;
  const en = locale === 'en';
  const mode = supplyModeLabel(sp.mode.kind, locale);
  if (en) {
    return {
      headline: `${result.connections} house connections: ${family} ${t.trunk.size} trunk${t.branch ? ` with ${t.branches} branches of ${t.branch.size}` : ''}, ${lowerFirst(mode)}`,
      body:
        `Peak hour ${id(sp.peakHourLs, locale)} l/s for ${result.connections} connections. The ${t.trunk.size} trunk runs at ${id(t.trunk.velocityMs, locale)} m/s and loses ${id(t.trunk.frictionLossM, locale)} m over ${id(t.trunk.lengthM, locale)} m` +
        (t.branch
          ? `; each of the ${t.branches} branches carries ${id(t.branch.flowLs, locale)} l/s in ${t.branch.size}, losing ${id(t.branch.frictionLossM, locale)} m. `
          : `. The number of branches was not given, so the whole flow is sized through one pipe — an assumption, not a layout. `) +
        `At the critical point the network needs ${id(sp.criticalPath.requiredHeadM, locale)} m; ${result.pumpDuty ? `the ${sp.mode.pumpHeadM} m pump duty covers the shortfall and must be matched to the maker’s pump curve` : `${id(sp.mode.residualAtCriticalBar, locale)} bar remains without a pump`}. ` +
        `Pressure class PN ${sp.pressureClass.pn ?? '—'} from ${id(sp.maxPressureBar, locale)} bar working pressure${sp.surgeBar > 0 ? ` plus ${id(sp.surgeBar, locale)} bar surge` : ''}; the catalog does not state PN for ${family}, so the class must be confirmed with Pralon. Initial estimate, not a final design.`,
    };
  }
  return {
    headline: `${result.connections} sambungan rumah: pipa induk ${family} ${t.trunk.size}${t.branch ? ` dengan ${t.branches} cabang ${t.branch.size}` : ''}, ${lowerFirst(mode)}`,
    body:
      `Jam puncak ${id(sp.peakHourLs)} l/s untuk ${result.connections} sambungan. Pipa induk ${t.trunk.size} mengalir ${id(t.trunk.velocityMs)} m/s dengan kerugian ${id(t.trunk.frictionLossM)} m sepanjang ${id(t.trunk.lengthM)} m` +
      (t.branch
        ? `; tiap dari ${t.branches} cabang membawa ${id(t.branch.flowLs)} l/s di ${t.branch.size}, kerugian ${id(t.branch.frictionLossM)} m. `
        : `. Jumlah cabang belum disebut, jadi seluruh debit dihitung lewat satu pipa — asumsi, bukan tata letak. `) +
      `Di titik kritis jaringan butuh ${id(sp.criticalPath.requiredHeadM)} m; ${result.pumpDuty ? `pompa ${id(sp.mode.pumpHeadM)} m menutup kekurangannya dan harus dicocokkan dengan kurva pompa pabrikan` : `tanpa pompa masih tersisa ${id(sp.mode.residualAtCriticalBar)} bar`}. ` +
      `Kelas tekanan PN ${sp.pressureClass.pn ?? '—'} dari tekanan kerja ${id(sp.maxPressureBar)} bar${sp.surgeBar > 0 ? ` ditambah surja ${id(sp.surgeBar)} bar` : ''}; katalog tidak mencantumkan PN untuk ${family}, jadi kelasnya harus dikonfirmasi ke Pralon. Perkiraan awal, bukan desain final.`,
  };
}
