/**
 * Hasil engine gedung bertingkat (Kelompok I + F) + trace → layar solusi, untuk kasus teknis
 * `multistorey_building_water` (keputusan pemilik 2026-10-09: gedung > 4 lantai tetap dihitung).
 * **Fungsi murni.** Setiap angka dari hasil hitungan; setiap baris menunjuk trace-nya.
 */
import {
  applyAssumption,
  assumptionDescription,
  type BuildingWaterInput,
  type BuildingWaterResult,
  type PipeMaterial,
} from '@snouty/engineering';
import {
  DEFAULT_LOCALE,
  type Assumption,
  type BomItem,
  type KeyValue,
  type Locale,
  type Provenance,
  type RecommendationStats,
  type RequirementState,
  type SystemLine,
  type TechnicalParameter,
} from '@snouty/shared-types';
import type { IdentifiedTrace } from './solution-view.js';

const MATERIAL: Readonly<Record<string, PipeMaterial>> = {
  'PVC (uPVC)': 'PVC',
  HDPE: 'HDPE',
  PPR: 'PPR',
  Galvanis: 'Galvanis',
};

function numberOf(p: TechnicalParameter | undefined): number | undefined {
  return typeof p?.value === 'number' && p.value > 0 ? p.value : undefined;
}

/** Parameter kasus gedung → masukan engine; `null` = jumlah lantai atau dasar kebutuhan belum ada. */
export function buildingWaterInputFrom(state: RequirementState): BuildingWaterInput | null {
  if (
    state.useCase?.kind !== 'technical' ||
    state.useCase.caseId !== 'multistorey_building_water'
  ) {
    return null;
  }
  const p = state.useCase.parameters;
  const floors = numberOf(p['building_floors']);
  const occupants = numberOf(p['number_of_occupants']);
  const floorAreaM2 = numberOf(p['floor_area']);
  if (floors === undefined || (occupants === undefined && floorAreaM2 === undefined)) return null;
  const height = numberOf(p['building_height']);
  const residual = numberOf(p['required_pressure']);
  const route = numberOf(p['route_length']);
  const bathroomsPerFloor = numberOf(p['bathrooms_per_floor']);
  const basinsPerFloor = numberOf(p['basins_per_floor']);
  const materialLabel = p['material']?.value;
  const material = typeof materialLabel === 'string' ? MATERIAL[materialLabel] : undefined;
  return {
    floors: Math.round(floors),
    ...(occupants !== undefined
      ? { occupants: Math.round(occupants) }
      : { floorAreaM2: floorAreaM2! }),
    // Tinggi bangunan yang disebut adalah tinggi total — dibagi rata per lantai.
    ...(height !== undefined ? { floorHeightM: Math.round((height / floors) * 100) / 100 } : {}),
    ...(residual !== undefined ? { residualPressureBar: residual } : {}),
    ...(route !== undefined ? { horizontalRunM: route } : {}),
    ...(material !== undefined ? { material } : {}),
    ...(bathroomsPerFloor !== undefined
      ? { bathroomsPerFloor: Math.round(bathroomsPerFloor) }
      : {}),
    ...(basinsPerFloor !== undefined ? { basinsPerFloor: Math.round(basinsPerFloor) } : {}),
  };
}

export const familyOf = (material: PipeMaterial): 'PVC AW' | 'HDPE' | 'PPR' | 'Galvanis' =>
  material === 'PVC' ? 'PVC AW' : material;

/** Trace engine dipecah per bagian: kebutuhan/zona, transfer, pembagian riser, riser. */
export function buildingTraceParts(
  result: BuildingWaterResult,
  traces: readonly IdentifiedTrace[],
) {
  const g = result.traceGroups;
  let at = 0;
  const next = (n: number) => traces.slice(at, (at += n));
  return {
    demand: next(g.demand),
    transfer: next(g.transfer),
    split: next(g.split),
    riser: next(g.riser),
    floor: next(g.floor),
  };
}

const num = (n: number, locale: Locale) =>
  n.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });

function worst(traces: readonly IdentifiedTrace[]): Provenance {
  const order: readonly Provenance[] = ['VERIFIED', 'ESTIMATED', 'ASSUMED', 'UNAVAILABLE'];
  return traces.reduce<Provenance>(
    (w, t) => (order.indexOf(t.provenance) > order.indexOf(w) ? t.provenance : w),
    'VERIFIED',
  );
}
const ids = (traces: readonly IdentifiedTrace[]) => traces.map((t) => t.id);
const explain = (traces: readonly IdentifiedTrace[], ruleId: string) =>
  traces.find((t) => t.ruleId === ruleId)?.explanation ?? '';

export function buildingHighlights(
  result: BuildingWaterResult,
  productCount: number,
  locale: Locale = DEFAULT_LOCALE,
): readonly KeyValue[] {
  const en = locale === 'en';
  const l = locale;
  const pump = result.transfer.pumpDuty;
  return [
    {
      label: en ? 'Occupants' : 'Penghuni',
      value: `${num(result.occupants, l)} ${en ? 'people' : 'orang'}${result.occupantsEstimated ? (en ? ' (from floor area)' : ' (dari luas lantai)') : ''}`,
    },
    {
      label: en ? 'Daily demand' : 'Kebutuhan harian',
      value: `${num(result.demand.dailyM3, l)} m³`,
    },
    {
      label: en ? 'Pressure zones' : 'Zona tekanan',
      value: `${result.zoning.zones}${result.zoning.boosterFloors > 0 ? (en ? ` + booster for top ${result.zoning.boosterFloors} floors` : ` + booster ${result.zoning.boosterFloors} lantai teratas`) : ''}`,
    },
    {
      label: en ? 'Transfer pump' : 'Pompa transfer',
      value: pump
        ? `${num(pump.flowM3h, l)} ${en ? 'm³/h' : 'm³/jam'} @ ${num(pump.headM, l)} m`
        : '-',
    },
    {
      label: en ? 'Distribution risers' : 'Riser distribusi',
      value: `${result.risers} × ${result.riser.recommendedSize}`,
    },
    ...(result.floorBranch !== null
      ? [
          {
            label: en ? 'Each floor' : 'Tiap lantai',
            value: en
              ? `${result.floorBranch.outletsPerFloor} outlets · header ${result.floorBranch.header.recommendedSize}`
              : `${result.floorBranch.outletsPerFloor} titik · induk ${result.floorBranch.header.recommendedSize}`,
          },
        ]
      : []),
    { label: en ? 'Products matched' : 'Produk cocok', value: String(productCount) },
  ];
}

export function buildingStats(
  result: BuildingWaterResult,
  productCount: number,
): RecommendationStats {
  return {
    outletCount: 1,
    mainSize: result.transfer.recommendedSize,
    branchCount: result.risers,
    fixtureConnectionSize: result.riser.recommendedSize,
    productCount,
  };
}

export function buildingSystemLines(
  result: BuildingWaterResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
): readonly SystemLine[] {
  const en = locale === 'en';
  const parts = buildingTraceParts(result, traces);
  const transferFamily = familyOf(result.transferMaterial);
  const pump = result.transfer.pumpDuty;
  const lines: SystemLine[] = [
    {
      name: en ? `${transferFamily} transfer pipe` : `Pipa transfer ${transferFamily}`,
      path: en ? 'Ground tank → roof tank' : 'Tangki bawah → tangki atap',
      size: result.transfer.recommendedSize,
      reason: `${explain(parts.demand, 'ENG-502')} ${explain(parts.transfer, 'ENG-205')}`.trim(),
      provenance: worst([...parts.demand, ...parts.transfer]),
      traceIds: ids([...parts.demand, ...parts.transfer]),
      role: 'main',
    },
    {
      name: en
        ? `${familyOf(result.riserMaterial)} distribution riser (${result.risers}×)`
        : `Riser distribusi ${familyOf(result.riserMaterial)} (${result.risers}×)`,
      path: en ? 'Roof tank → floors' : 'Tangki atap → tiap lantai',
      size: result.riser.recommendedSize,
      reason: `${explain(parts.split, 'ENG-504')} ${explain(parts.riser, 'ENG-205')}`.trim(),
      provenance: worst([...parts.split, ...parts.riser]),
      traceIds: ids([...parts.split, ...parts.riser]),
      role: 'riser',
    },
    {
      name: en ? 'Transfer pump (duty point)' : 'Pompa transfer (titik kerja)',
      path: en ? 'Ground tank' : 'Tangki bawah',
      size: pump
        ? `${num(pump.flowM3h, locale)} ${en ? 'm³/h' : 'm³/jam'} @ ${num(pump.headM, locale)} m`
        : '-',
      reason: `${explain(parts.transfer, 'ENG-204')} ${explain(parts.transfer, 'ENG-206')}`.trim(),
      provenance: worst(parts.transfer),
      traceIds: ids(parts.transfer),
      role: 'fitting',
    },
    {
      name: en ? 'Pressure zones and booster' : 'Zona tekanan dan booster',
      path: en ? 'Every floor' : 'Seluruh lantai',
      size: en ? `${result.zoning.zones} zone(s)` : `${result.zoning.zones} zona`,
      reason: explain(parts.demand, 'ENG-503'),
      provenance: worst(parts.demand),
      traceIds: ids(parts.demand),
      role: 'branch',
    },
  ];
  const floor = result.floorBranch;
  if (floor !== null) {
    const fam = familyOf(result.riserMaterial);
    lines.push(
      {
        name: en ? `${fam} floor header` : `Pipa induk lantai ${fam}`,
        path: en ? 'Riser → each floor' : 'Riser → tiap lantai',
        size: floor.header.recommendedSize,
        reason:
          `${explain(parts.floor, 'ENG-001')} ${explain(parts.floor, 'ENG-505')} ${explain(parts.floor, 'ENG-205')}`.trim(),
        provenance: worst(parts.floor),
        traceIds: ids(parts.floor),
        role: 'branch',
      },
      {
        name: en ? 'Fixture connections' : 'Sambungan titik air',
        path: en
          ? `${floor.outletsPerFloor} outlets per floor, ${floor.branchesPerFloor} branches`
          : `${floor.outletsPerFloor} titik per lantai, ${floor.branchesPerFloor} cabang`,
        size: floor.fixtureConnectionSize,
        reason: `${explain(parts.floor, 'ENG-003')} ${explain(parts.floor, 'ENG-005')}`.trim(),
        provenance: worst(parts.floor),
        traceIds: ids(parts.floor),
        role: 'fixture',
      },
    );
  }
  return lines;
}

const ROD_METERS = 4;

/** BOM pipa tegak saja — jalur datar dan pipa cabang per lantai belum diketahui. */
export function buildingBomItems(
  result: BuildingWaterResult,
  input: BuildingWaterInput,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
): readonly BomItem[] {
  const en = locale === 'en';
  const parts = buildingTraceParts(result, traces);
  const height = result.zoning.buildingHeightM;
  const transferFamily = familyOf(result.transferMaterial);
  const transferLength = height + (input.horizontalRunM ?? 0);
  const basis = en
    ? 'Vertical runs only, as tall as the building; floor branches follow the floor plan.'
    : 'Hanya jalur tegak setinggi gedung; pipa cabang tiap lantai mengikuti denah.';
  const transferIds = ids(parts.transfer);
  const riserIds = ids([...parts.split, ...parts.riser]);
  const items: BomItem[] = [
    transferFamily === 'HDPE'
      ? {
          item: en ? 'HDPE transfer pipe' : 'Pipa transfer HDPE',
          size: result.transfer.recommendedSize,
          quantity: Math.ceil(transferLength),
          unit: 'meter',
          basis,
          provenance: worst(parts.transfer),
          traceIds: transferIds,
        }
      : {
          item: en ? `${transferFamily} transfer pipe` : `Pipa transfer ${transferFamily}`,
          size: result.transfer.recommendedSize,
          quantity: Math.ceil(transferLength / ROD_METERS),
          unit: 'batang',
          basis,
          provenance: worst(parts.transfer),
          traceIds: transferIds,
        },
    {
      item: en
        ? `${familyOf(result.riserMaterial)} riser pipe`
        : `Pipa riser ${familyOf(result.riserMaterial)}`,
      size: result.riser.recommendedSize,
      quantity: Math.ceil(height / ROD_METERS) * result.risers,
      unit: 'batang',
      basis,
      provenance: worst([...parts.split, ...parts.riser]),
      traceIds: riserIds,
    },
  ];
  const floor = result.floorBranch;
  if (floor !== null) {
    const fam = familyOf(result.riserMaterial);
    const floorIds = ids(parts.floor);
    items.push({
      item: en ? `${fam} floor header pipe` : `Pipa induk lantai ${fam}`,
      size: floor.header.recommendedSize,
      quantity: Math.ceil(floor.headerLengthM / ROD_METERS) * input.floors,
      unit: 'batang',
      basis: en
        ? 'One header per floor, as long as the side of the floor plan; branches to each outlet follow the layout.'
        : 'Satu pipa induk per lantai, sepanjang sisi denah; cabang ke tiap titik mengikuti tata letak.',
      provenance: worst(parts.floor),
      traceIds: floorIds,
    });
  }
  return items;
}

export function buildingAssumptions(
  result: BuildingWaterResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
): readonly Assumption[] {
  const en = locale === 'en';
  return [
    {
      text: en
        ? 'How it is worked out: number of people × water per person gives the daily need; from that come the busiest-hour flow (for the transfer pump) and the busiest-minute flow (for the risers). The building height sets how many pressure zones are needed, and each pipe is the smallest size whose water speed stays in the safe range. This is an initial estimate not yet checked by the Pralon technical team, not a working drawing. Pumps are still chosen from the manufacturer’s curve.'
        : 'Cara hitungnya: jumlah orang × kebutuhan air per orang memberi kebutuhan harian; dari situ keluar debit jam tersibuk (untuk pompa transfer) dan debit menit tersibuk (untuk riser). Tinggi gedung menentukan berapa zona tekanan yang perlu, dan tiap pipa dipilih ukuran terkecil yang kecepatan airnya masih aman. Ini perkiraan awal yang belum diperiksa tim teknis Pralon, bukan gambar kerja. Pompa tetap dipilih dari kurva pabrikan.',
      // Penjelasan cara hitung, bukan asumsi yang bisa diubah — tanpa tombol Perbaiki.
      fieldPath: '',
      ruleId: 'ENG-502',
    },
    ...result.appliedAssumptionIds.map((aid) => {
      const a = applyAssumption(aid);
      return {
        text: assumptionDescription(aid, locale),
        fieldPath: a.parameter,
        ruleId: 'ENG-502',
        assumptionId: a.id,
      };
    }),
  ];
}

/** Prosa deterministik — setiap angka dari hasil hitungan. */
export function buildingProse(
  result: BuildingWaterResult,
  floors: number,
  locale: Locale = DEFAULT_LOCALE,
): { headline: string; body: string } {
  const l = locale;
  const pump = result.transfer.pumpDuty;
  const family = familyOf(result.transferMaterial);
  const z = result.zoning;
  if (locale === 'en') {
    return {
      headline: `${floors}-storey building: ${family} ${result.transfer.recommendedSize} transfer, ${result.risers} × ${result.riser.recommendedSize} risers, ${z.zones} pressure zone(s)`,
      body: `${num(result.occupants, l)} people use about ${num(result.demand.dailyM3, l)} m³ of water a day. A ${family} ${result.transfer.recommendedSize} transfer pipe fills the roof tank at the peak-hour flow of ${num(result.demand.peakHourLs, l)} l/s${pump ? `, with a pump of ${num(pump.flowM3h, l)} m³/h at ${num(pump.headM, l)} m head` : ''}. From the roof tank, ${result.risers} ${familyOf(result.riserMaterial)} ${result.riser.recommendedSize} riser(s) carry the peak-minute flow of ${num(result.demand.peakMinuteLs, l)} l/s down through ${z.zones} pressure zone(s)${z.boosterFloors > 0 ? `; the top ${z.boosterFloors} floor(s) need a booster pump` : ''}. Initial estimate, not a final design.`,
    };
  }
  return {
    headline: `Gedung ${floors} lantai: transfer ${family} ${result.transfer.recommendedSize}, ${result.risers} riser ${result.riser.recommendedSize}, ${z.zones} zona tekanan`,
    body: `${num(result.occupants, l)} orang memakai sekitar ${num(result.demand.dailyM3, l)} m³ air per hari. Pipa transfer ${family} ${result.transfer.recommendedSize} mengisi tangki atap pada debit jam puncak ${num(result.demand.peakHourLs, l)} l/s${pump ? `, dengan pompa ${num(pump.flowM3h, l)} m³/jam pada head ${num(pump.headM, l)} m` : ''}. Dari tangki atap, ${result.risers} riser ${familyOf(result.riserMaterial)} ${result.riser.recommendedSize} membawa debit menit puncak ${num(result.demand.peakMinuteLs, l)} l/s turun melalui ${z.zones} zona tekanan${z.boosterFloors > 0 ? `; ${z.boosterFloors} lantai teratas butuh pompa booster` : ''}. Perkiraan awal, bukan desain final.`,
  };
}
