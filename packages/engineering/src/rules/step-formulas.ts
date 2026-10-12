/**
 * Rumus singkat per langkah hitung, untuk laporan PDF (permintaan pemilik 2026-10-12: "cara hitungnya
 * panjang banget per poin, tulis lebih simpel dan ada rumusnya"). Setiap rumus dibangun dari masukan
 * dan keluaran trace aturan itu sendiri — angka tidak pernah dihitung ulang atau dikarang di sini.
 *
 * Aturan tanpa rumus di sini (atau trace yang bentuknya tidak dikenali) → `null`; pemanggil memakai
 * penjelasan aturannya (`explain`) seperti sebelumnya.
 */

import type { EngineeringLocale } from '../parameters/locale.js';

type Bag = Readonly<Record<string, unknown>>;

/** Satu bahasa: angka sudah diformat, tinggal disusun. */
type Formula = (input: Bag, output: Bag, f: Fmt) => string | null;

interface Fmt {
  readonly en: boolean;
  /** Angka dengan pemisah desimal sesuai bahasa, maksimal 2 desimal. */
  n(value: unknown): string;
  /** Pilih teks per bahasa. */
  t(id: string, en: string): string;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function fmt(locale: EngineeringLocale): Fmt {
  const en = locale === 'en';
  return {
    en,
    n: (value) =>
      isNum(value)
        ? value.toLocaleString(en ? 'en-US' : 'id-ID', {
            maximumFractionDigits: 2,
            useGrouping: false,
          })
        : '?',
    t: (id, enText) => (en ? enText : id),
  };
}

/** Semua angka yang dirujuk harus ada; bila tidak, rumus dibatalkan (bukan "?" di laporan). */
function nums(bag: Bag, keys: readonly string[]): boolean {
  return keys.every((k) => isNum(bag[k]));
}

const FORMULAS: Readonly<Record<string, Formula>> = {
  'ENG-001': (i, o, f) =>
    nums(i, ['bathrooms', 'basins', 'kitchens']) && nums(o, ['outletCount'])
      ? f.t(
          `Titik air = ${f.n(i['bathrooms'])} kamar mandi × 2 + ${f.n(i['basins'])} wastafel + ${f.n(i['kitchens'])} dapur = ${f.n(o['outletCount'])} titik`,
          `Outlets = ${f.n(i['bathrooms'])} bathrooms × 2 + ${f.n(i['basins'])} basins + ${f.n(i['kitchens'])} kitchens = ${f.n(o['outletCount'])}`,
        )
      : null,
  'ENG-003': (i, o, f) =>
    Array.isArray(i['outletsPerFloor']) && nums(o, ['branchCount', 'maxOutletsPerBranch'])
      ? f.t(
          `Titik per lantai ${(i['outletsPerFloor'] as unknown[]).map(f.n).join(' + ')} → ${f.n(o['branchCount'])} cabang (maks. ${f.n(o['maxOutletsPerBranch'])} titik per cabang)`,
          `Outlets per floor ${(i['outletsPerFloor'] as unknown[]).map(f.n).join(' + ')} → ${f.n(o['branchCount'])} branches (max ${f.n(o['maxOutletsPerBranch'])} per branch)`,
        )
      : null,
  'ENG-004': (_i, o, f) =>
    nums(o, ['floorHeightM'])
      ? f.t(
          `Tinggi lantai = ${f.n(o['floorHeightM'])} m`,
          `Floor height = ${f.n(o['floorHeightM'])} m`,
        )
      : null,
  'ENG-005': (_i, o, f) =>
    isStr(o['fixtureConnectionSize'])
      ? f.t(
          `Sambungan ke alat = ${o['fixtureConnectionSize']}`,
          `Fixture connection = ${o['fixtureConnectionSize']}`,
        )
      : null,
  'ENG-006': (_i, o, f) =>
    nums(o, ['minPercent', 'maxPercent'])
      ? f.t(
          `Cadangan lapangan = ${f.n(o['minPercent'])}–${f.n(o['maxPercent'])} %`,
          `Site allowance = ${f.n(o['minPercent'])}–${f.n(o['maxPercent'])} %`,
        )
      : null,
  'ENG-008': (i, o, f) => {
    const plan = o['floorsPlan'];
    if (!Array.isArray(plan) || !nums(i, ['floors', 'floorHeightM'])) return null;
    const top = (plan[0] ?? {}) as Bag;
    return isNum(top['elevationM'])
      ? f.t(
          `Lantai teratas = (${f.n(i['floors'])} − 1) × ${f.n(i['floorHeightM'])} m = ${f.n(top['elevationM'])} m`,
          `Top floor = (${f.n(i['floors'])} − 1) × ${f.n(i['floorHeightM'])} m = ${f.n(top['elevationM'])} m`,
        )
      : null;
  },
  'ENG-010': (_i, o, f) =>
    nums(o, ['minMs', 'maxMs'])
      ? f.t(
          `Kecepatan aliran = ${f.n(o['minMs'])}–${f.n(o['maxMs'])} m/s`,
          `Flow speed = ${f.n(o['minMs'])}–${f.n(o['maxMs'])} m/s`,
        )
      : null,
  'ENG-012': (_i, o, f) =>
    nums(o, ['loadWeight'])
      ? f.t(
          `Kamar mandi = shower + kloset = beban ${f.n(o['loadWeight'])}`,
          `Bathroom = shower + toilet = load ${f.n(o['loadWeight'])}`,
        )
      : null,
  'ENG-013': (_i, o, f) =>
    Array.isArray(o['classes'])
      ? f.t(
          `Kelas pipa = ${(o['classes'] as unknown[]).filter(isStr).join(', ')}`,
          `Pipe class = ${(o['classes'] as unknown[]).filter(isStr).join(', ')}`,
        )
      : null,
  'ENG-102': (i, o, f) =>
    nums(i, ['designFlowLs', 'velocityMs']) &&
    nums(o, ['requiredInnerDiameterMm', 'innerDiameterMm']) &&
    isStr(o['mainSize'])
      ? f.t(
          `d = √(4 × Q ÷ (π × v)) = √(4 × ${f.n(i['designFlowLs'])} l/s ÷ (π × ${f.n(i['velocityMs'])} m/s)) = ${f.n(o['requiredInnerDiameterMm'])} mm → ${o['mainSize']} (dalam ${f.n(o['innerDiameterMm'])} mm)`,
          `d = √(4 × Q ÷ (π × v)) = √(4 × ${f.n(i['designFlowLs'])} l/s ÷ (π × ${f.n(i['velocityMs'])} m/s)) = ${f.n(o['requiredInnerDiameterMm'])} mm → ${o['mainSize']} (inner ${f.n(o['innerDiameterMm'])} mm)`,
        )
      : null,
  'ENG-201': (i, o, f) =>
    nums(i, ['designFlowLs', 'innerDiameterMm']) && nums(o, ['areaMm2', 'velocityMs'])
      ? f.t(
          `v = Q ÷ A = ${f.n(i['designFlowLs'])} l/s ÷ ${f.n(o['areaMm2'])} mm² = ${f.n(o['velocityMs'])} m/s`,
          `v = Q ÷ A = ${f.n(i['designFlowLs'])} l/s ÷ ${f.n(o['areaMm2'])} mm² = ${f.n(o['velocityMs'])} m/s`,
        )
      : null,
  'ENG-202': (i, o, f) =>
    nums(i, ['designFlowLs', 'innerDiameterMm', 'lengthM', 'hazenWilliamsC']) &&
    nums(o, ['frictionLossM'])
      ? f.t(
          `hf = 10,67 × L × Q^1,852 ÷ (C^1,852 × d^4,87), dengan L ${f.n(i['lengthM'])} m, Q ${f.n(i['designFlowLs'])} l/s, C ${f.n(i['hazenWilliamsC'])}, d ${f.n(i['innerDiameterMm'])} mm → hf = ${f.n(o['frictionLossM'])} m`,
          `hf = 10.67 × L × Q^1.852 ÷ (C^1.852 × d^4.87), with L ${f.n(i['lengthM'])} m, Q ${f.n(i['designFlowLs'])} l/s, C ${f.n(i['hazenWilliamsC'])}, d ${f.n(i['innerDiameterMm'])} mm → hf = ${f.n(o['frictionLossM'])} m`,
        )
      : null,
  'ENG-203': (i, o, f) =>
    nums(i, ['frictionLossM', 'fraction']) && nums(o, ['minorLossM'])
      ? f.t(
          `Kehilangan sambungan = ${f.n((i['fraction'] as number) * 100)} % × ${f.n(i['frictionLossM'])} m = ${f.n(o['minorLossM'])} m`,
          `Fitting loss = ${f.n((i['fraction'] as number) * 100)} % × ${f.n(i['frictionLossM'])} m = ${f.n(o['minorLossM'])} m`,
        )
      : null,
  'ENG-204': (i, o, f) =>
    nums(i, ['staticHeadM', 'frictionLossM', 'minorLossM']) &&
    nums(o, ['residualHeadM', 'totalDynamicHeadM'])
      ? f.t(
          `H = beda tinggi + gesekan + sambungan + sisa tekanan = ${f.n(i['staticHeadM'])} + ${f.n(i['frictionLossM'])} + ${f.n(i['minorLossM'])} + ${f.n(o['residualHeadM'])} = ${f.n(o['totalDynamicHeadM'])} m`,
          `H = height + friction + fittings + residual = ${f.n(i['staticHeadM'])} + ${f.n(i['frictionLossM'])} + ${f.n(i['minorLossM'])} + ${f.n(o['residualHeadM'])} = ${f.n(o['totalDynamicHeadM'])} m`,
        )
      : null,
  'ENG-205': (_i, o, f) => {
    const candidates = o['candidates'];
    if (!Array.isArray(candidates) || !isStr(o['recommended'])) return null;
    const chosen = (candidates as Bag[]).find((c) => c['size'] === o['recommended']);
    if (!chosen || !nums(chosen, ['velocityMs', 'gradientMPer100m'])) return null;
    return f.t(
      `Dicoba ${f.n(candidates.length)} ukuran → terkecil yang lolos: ${o['recommended']} (v = ${f.n(chosen['velocityMs'])} m/s, kehilangan ${f.n(chosen['gradientMPer100m'])} m per 100 m)`,
      `Tried ${f.n(candidates.length)} sizes → smallest that passes: ${o['recommended']} (v = ${f.n(chosen['velocityMs'])} m/s, loss ${f.n(chosen['gradientMPer100m'])} m per 100 m)`,
    );
  },
  'ENG-601': (i, o, f) =>
    nums(i, ['waterClosets', 'showers', 'lavatories', 'kitchenSinks']) &&
    nums(i, ['dfuWaterCloset', 'dfuShower', 'dfuLavatory', 'dfuKitchenSink']) &&
    nums(o, ['soilDfu', 'wasteDfu'])
      ? f.t(
          `Air kotor = ${f.n(i['waterClosets'])} kloset × ${f.n(i['dfuWaterCloset'])} = ${f.n(o['soilDfu'])} DFU · Air bekas = ${f.n(i['showers'])} × ${f.n(i['dfuShower'])} + ${f.n(i['lavatories'])} × ${f.n(i['dfuLavatory'])} + ${f.n(i['kitchenSinks'])} × ${f.n(i['dfuKitchenSink'])} = ${f.n(o['wasteDfu'])} DFU`,
          `Soil = ${f.n(i['waterClosets'])} WC × ${f.n(i['dfuWaterCloset'])} = ${f.n(o['soilDfu'])} DFU · Waste = ${f.n(i['showers'])} × ${f.n(i['dfuShower'])} + ${f.n(i['lavatories'])} × ${f.n(i['dfuLavatory'])} + ${f.n(i['kitchenSinks'])} × ${f.n(i['dfuKitchenSink'])} = ${f.n(o['wasteDfu'])} DFU`,
        )
      : null,
  'ENG-602': (i, o, f) =>
    nums(i, ['dfu']) && nums(o, ['capacityDfu']) && isStr(o['size']) && isStr(o['ventSize'])
      ? f.t(
          `${f.n(i['dfu'])} DFU ≤ ${f.n(o['capacityDfu'])} (kapasitas ${o['size']}) → pipa ${o['size']}, ventilasi ${o['ventSize']}`,
          `${f.n(i['dfu'])} DFU ≤ ${f.n(o['capacityDfu'])} (capacity of ${o['size']}) → pipe ${o['size']}, vent ${o['ventSize']}`,
        )
      : null,
  'ENG-603': (i, o, f) => {
    if (!nums(i, ['planLengthM', 'floors', 'floorHeightM', 'ventAboveRoofM'])) return null;
    const parts: string[] = [];
    // Halaman (ENG-603 v2); trace v1 tidak punya `yardM`.
    const yard = isNum(i['yardM']) && i['yardM'] > 0 ? ` + ${f.n(i['yardM'])}` : '';
    if (isNum(o['soilNetM']))
      parts.push(
        f.t(
          `Air kotor = ${f.n(i['planLengthM'])} + ${f.n(i['floorHeightM'])} × (${f.n(i['floors'])} − 1)${yard} = ${f.n(o['soilNetM'])} m`,
          `Soil = ${f.n(i['planLengthM'])} + ${f.n(i['floorHeightM'])} × (${f.n(i['floors'])} − 1)${yard} = ${f.n(o['soilNetM'])} m`,
        ),
      );
    if (isNum(o['wasteNetM']))
      parts.push(
        f.t(
          `Air bekas = ${f.n(i['planLengthM'])}${yard} = ${f.n(o['wasteNetM'])} m`,
          `Waste = ${f.n(i['planLengthM'])}${yard} = ${f.n(o['wasteNetM'])} m`,
        ),
      );
    const vent = isNum(o['soilVentNetM']) ? o['soilVentNetM'] : o['wasteVentNetM'];
    if (isNum(vent))
      parts.push(
        f.t(
          `Ventilasi = ${f.n(i['floors'])} × ${f.n(i['floorHeightM'])} + ${f.n(i['ventAboveRoofM'])} = ${f.n(vent)} m per jalur`,
          `Vent = ${f.n(i['floors'])} × ${f.n(i['floorHeightM'])} + ${f.n(i['ventAboveRoofM'])} = ${f.n(vent)} m per line`,
        ),
      );
    return parts.length > 0 ? parts.join(' · ') : null;
  },
  'ENG-704': (i, o, f) =>
    nums(i, ['planLengthM', 'branchCount', 'outletCount', 'fixtureDropM']) &&
    nums(o, ['branchNetM', 'fixtureNetM', 'teeCount'])
      ? f.t(
          `Cabang = ${f.n(i['branchCount'])} × ${f.n(i['planLengthM'])} m = ${f.n(o['branchNetM'])} m · Sambungan = ${f.n(i['outletCount'])} × ${f.n(i['fixtureDropM'])} m = ${f.n(o['fixtureNetM'])} m · Tee = ${f.n(o['teeCount'])}`,
          `Branches = ${f.n(i['branchCount'])} × ${f.n(i['planLengthM'])} m = ${f.n(o['branchNetM'])} m · Connections = ${f.n(i['outletCount'])} × ${f.n(i['fixtureDropM'])} m = ${f.n(o['fixtureNetM'])} m · Tees = ${f.n(o['teeCount'])}`,
        )
      : null,
  'ENG-701': (i, o, f) =>
    nums(i, ['waterClosets', 'showers', 'lavatories', 'kitchenSinks']) &&
    nums(i, ['wsfuWaterCloset', 'wsfuShower', 'wsfuLavatory', 'wsfuKitchenSink']) &&
    nums(o, ['wsfu', 'peakFlowLs'])
      ? f.t(
          `Beban = ${f.n(i['waterClosets'])} × ${f.n(i['wsfuWaterCloset'])} + ${f.n(i['showers'])} × ${f.n(i['wsfuShower'])} + ${f.n(i['lavatories'])} × ${f.n(i['wsfuLavatory'])} + ${f.n(i['kitchenSinks'])} × ${f.n(i['wsfuKitchenSink'])} = ${f.n(o['wsfu'])} unit → Q = ${f.n(o['peakFlowLs'])} l/s (kurva Hunter)`,
          `Load = ${f.n(i['waterClosets'])} × ${f.n(i['wsfuWaterCloset'])} + ${f.n(i['showers'])} × ${f.n(i['wsfuShower'])} + ${f.n(i['lavatories'])} × ${f.n(i['wsfuLavatory'])} + ${f.n(i['kitchenSinks'])} × ${f.n(i['wsfuKitchenSink'])} = ${f.n(o['wsfu'])} units → Q = ${f.n(o['peakFlowLs'])} l/s (Hunter curve)`,
        )
      : null,
  'ENG-702': (i, o, f) => {
    if (!nums(o, ['staticHeadM', 'routeLengthM']) || !nums(i, ['horizontalRunM'])) return null;
    const yard = isNum(i['yardM']) && i['yardM'] > 0 ? ` + halaman ${f.n(i['yardM'])}` : '';
    const yardEn = isNum(i['yardM']) && i['yardM'] > 0 ? ` + yard ${f.n(i['yardM'])}` : '';
    const vertical = isNum(o['tankLevelM'])
      ? Math.round(((o['tankLevelM'] as number) - (o['highestOutletM'] as number)) * 100) / 100
      : (o['highestOutletM'] as number);
    return f.t(
      `Beda tinggi = ${f.n(o['staticHeadM'])} m · Panjang jalur = ${f.n(vertical)} tegak + ${f.n(i['horizontalRunM'])} datar${yard} = ${f.n(o['routeLengthM'])} m`,
      `Height difference = ${f.n(o['staticHeadM'])} m · Route length = ${f.n(vertical)} vertical + ${f.n(i['horizontalRunM'])} horizontal${yardEn} = ${f.n(o['routeLengthM'])} m`,
    );
  },
  'ENG-706': (i, o, f) =>
    nums(i, ['yardM', 'buildingSideM', 'tankLevelM']) && nums(o, ['fillNetM'])
      ? f.t(
          `Pipa pengisi toren = ${f.n(i['yardM'])} + ${f.n(i['buildingSideM'])} + ${f.n(i['tankLevelM'])} = ${f.n(o['fillNetM'])} m`,
          `Tank fill pipe = ${f.n(i['yardM'])} + ${f.n(i['buildingSideM'])} + ${f.n(i['tankLevelM'])} = ${f.n(o['fillNetM'])} m`,
        )
      : null,
  'ENG-705': (i, o, f) =>
    nums(i, ['landSideM', 'buildingSideM']) && nums(o, ['yardM'])
      ? f.t(
          `Halaman = sisi tanah ${f.n(i['landSideM'])} m − sisi bangunan ${f.n(i['buildingSideM'])} m = ${f.n(o['yardM'])} m`,
          `Yard = land side ${f.n(i['landSideM'])} m − building side ${f.n(i['buildingSideM'])} m = ${f.n(o['yardM'])} m`,
        )
      : null,
};

export function stepFormula(
  ruleId: string,
  inputs: unknown,
  output: unknown,
  locale: EngineeringLocale = 'id',
): string | null {
  const formula = FORMULAS[ruleId];
  if (formula === undefined) return null;
  const bag = (v: unknown): Bag => (v !== null && typeof v === 'object' ? (v as Bag) : {});
  return formula(bag(inputs), bag(output), fmt(locale));
}
