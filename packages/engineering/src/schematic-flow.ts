/**
 * Skema ALIRAN untuk kasus teknis (kolam, transfer pompa, sumur, cluster, irigasi, drainase, air
 * hujan, gorong-gorong, gedung bertingkat) — permintaan pemilik 2026-10-09 "ai ini bisa generate
 * skemanya". **Fungsi murni**: setiap simpul dan jalur dibentuk dari hasil hitungan kasusnya,
 * bukan gambar per skenario. Renderer (web) menggambarnya sebagai rel vertikal desain layar 09:
 * kotak sumber → jalur merah berlabel ukuran → simpul pipa → kotak zona → titik ujung.
 *
 * Seperti `schematic.ts`, paket ini tidak bergantung pada `@snouty/shared-types`; tipe kawatnya
 * dideklarasikan ulang di sana secara struktural.
 */

import type { BuildingWaterResult } from './compute-building.js';
import type { GravityResult } from './compute-gravity.js';
import type { IrrigationInput, IrrigationResult } from './compute-irrigation.js';
import type { NetworkResult } from './compute-network.js';
import type { PondInput, PondResult } from './compute-pond.js';
import type { PressurizedResult } from './compute-pressurized.js';
import type { EngineeringLocale } from './parameters/locale.js';
import type { Provenance } from './provenance.js';

export type FlowNodeType =
  'source' | 'pump' | 'tank' | 'pipe' | 'pond' | 'zone' | 'area' | 'outlet';

export interface FlowNodeShape {
  readonly id: string;
  readonly type: FlowNodeType;
  readonly title: string;
  readonly detail?: string;
  /** Simpul pipa yang dihitung — digambar menonjol (merah muda) seperti PIPA UTAMA di desain. */
  readonly highlighted: boolean;
  readonly provenance: Provenance;
}

export type FlowLinkRole = 'main' | 'riser' | 'branch' | 'drain' | 'fixture_connection';

/** Jalur antara simpul ke-i dan ke-(i+1). */
export interface FlowLinkShape {
  readonly role: FlowLinkRole;
  /** "6\" · PVC AW", "160 mm · HDPE" — kosong untuk sambungan tanpa ukuran. */
  readonly label: string;
  readonly provenance: Provenance;
}

/** Deret titik ujung di bawah rel (sambungan rumah, titik air per lantai, lateral lahan). */
export interface FlowLeavesShape {
  readonly title: string;
  readonly items: readonly { readonly label: string; readonly detail?: string }[];
  readonly connection: string;
}

export interface FlowSchematicShape {
  readonly kind: 'flow';
  readonly nodes: readonly FlowNodeShape[];
  /** `links.length === nodes.length - 1`. */
  readonly links: readonly FlowLinkShape[];
  readonly leaves: FlowLeavesShape | null;
  readonly titleBlock: {
    readonly drawing: string;
    readonly scale: 'NTS';
    readonly basis: string;
    readonly source: string;
  };
}

const n = (value: number, locale: EngineeringLocale): string =>
  value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });
const pipe = (size: string, family: string) => `${size} · ${family}`;
const flowOf = (ls: number, locale: EngineeringLocale) => `${n(ls, locale)} l/s`;

interface Builder {
  readonly nodes: FlowNodeShape[];
  readonly links: FlowLinkShape[];
  node(type: FlowNodeType, title: string, detail?: string, highlighted?: boolean): Builder;
  link(role: FlowLinkRole, label: string): Builder;
}

function builder(provenance: Provenance): Builder {
  const b: Builder = {
    nodes: [],
    links: [],
    node(type, title, detail, highlighted = false) {
      b.nodes.push({
        id: `n${b.nodes.length + 1}`,
        type,
        title,
        ...(detail !== undefined ? { detail } : {}),
        highlighted,
        provenance,
      });
      return b;
    },
    link(role, label) {
      b.links.push({ role, label, provenance });
      return b;
    },
  };
  return b;
}

function finish(
  b: Builder,
  leaves: FlowLeavesShape | null,
  drawing: string,
  basis: string,
  catalogVersionLabel: string,
): FlowSchematicShape {
  if (b.links.length !== b.nodes.length - 1) {
    throw new Error(
      `skema aliran tidak konsisten: ${b.nodes.length} simpul, ${b.links.length} jalur`,
    );
  }
  return {
    kind: 'flow',
    nodes: b.nodes,
    links: b.links,
    leaves,
    titleBlock: {
      drawing,
      scale: 'NTS',
      basis,
      source: `KATALOG ${catalogVersionLabel.toUpperCase()}`,
    },
  };
}

const T = (locale: EngineeringLocale, id: string, en: string) => (locale === 'en' ? en : id);

// ── Kolam / tambak ──────────────────────────────────────────────────────────

export function pondSchematic(
  input: PondInput,
  result: PondResult,
  catalogVersionLabel: string,
  locale: EngineeringLocale,
): FlowSchematicShape {
  const t = (id: string, en: string) => T(locale, id, en);
  const depth = input.depthM !== undefined ? ` × ${n(input.depthM, locale)}` : '';
  const b = builder(result.overallProvenance)
    .node(
      'source',
      t('SUMBER AIR', 'WATER SOURCE'),
      `${n(result.flowM3h, locale)} ${t('m³/jam', 'm³/h')}`,
    )
    .link('main', pipe(result.inletSize, result.inletFamily))
    .node('pipe', t('PIPA MASUK', 'INLET PIPE'), flowOf(result.designFlowLs, locale), true)
    .link('main', '')
    .node(
      'pond',
      result.ponds > 1 ? t(`${result.ponds} KOLAM`, `${result.ponds} PONDS`) : t('KOLAM', 'POND'),
      `${n(input.lengthM, locale)} × ${n(input.widthM, locale)}${depth} m · ${n(result.volumeM3, locale)} m³`,
    )
    .link('drain', pipe(result.drainSize, result.drainFamily))
    .node('pipe', t('PIPA KURAS', 'DRAIN PIPE'), flowOf(result.drainFlowLs, locale), true)
    .link('drain', '')
    .node('outlet', t('SALURAN BUANG', 'OUTFALL'));
  return finish(
    b,
    null,
    t('SK-02 KOLAM', 'SK-02 POND'),
    t('ISI & KURAS', 'FILL & DRAIN'),
    catalogVersionLabel,
  );
}

// ── Transfer pompa / sumur ──────────────────────────────────────────────────

export interface PressurizedSchematicInput {
  readonly kind: 'pump_transfer' | 'well_distribution';
  readonly designFlowLs: number;
  readonly routeLengthM: number;
  readonly staticHeadM: number;
  readonly family: string;
}

export function pressurizedSchematic(
  input: PressurizedSchematicInput,
  result: PressurizedResult,
  catalogVersionLabel: string,
  locale: EngineeringLocale,
): FlowSchematicShape {
  const t = (id: string, en: string) => T(locale, id, en);
  const well = input.kind === 'well_distribution';
  const b = builder(result.overallProvenance).node(
    'source',
    well ? t('SUMUR', 'WELL') : t('SUMBER', 'SOURCE'),
    flowOf(input.designFlowLs, locale),
  );
  if (result.pumpDuty) {
    b.link('main', '').node(
      'pump',
      t('POMPA', 'PUMP'),
      `${n(result.pumpDuty.flowM3h, locale)} ${t('m³/jam', 'm³/h')} @ ${n(result.pumpDuty.headM, locale)} m`,
    );
  }
  b.link('main', pipe(result.recommendedSize, input.family))
    .node(
      'pipe',
      t('PIPA UTAMA', 'MAIN PIPE'),
      `${n(input.routeLengthM, locale)} m · ${n(result.velocityMs, locale)} m/s`,
      true,
    )
    .link('main', '')
    .node(
      'tank',
      well ? t('TOREN', 'STORAGE TANK') : t('TUJUAN', 'DESTINATION'),
      input.staticHeadM !== 0
        ? `${input.staticHeadM > 0 ? '+' : ''}${n(input.staticHeadM, locale)} m`
        : undefined,
    );
  return finish(
    b,
    null,
    well ? t('SK-03 SUMUR', 'SK-03 WELL') : t('SK-03 TRANSFER', 'SK-03 TRANSFER'),
    t('HEAD TOTAL', 'TOTAL HEAD') + ` ${n(result.totalDynamicHeadM, locale)} M`,
    catalogVersionLabel,
  );
}

// ── Cluster perumahan ───────────────────────────────────────────────────────

export function networkSchematic(
  input: { readonly routeLengthM: number; readonly family: string },
  result: NetworkResult,
  catalogVersionLabel: string,
  locale: EngineeringLocale,
): FlowSchematicShape {
  const t = (id: string, en: string) => T(locale, id, en);
  const b = builder(result.overallProvenance).node(
    'source',
    t('RESERVOIR', 'RESERVOIR'),
    `${t('puncak', 'peak')} ${flowOf(result.peakFlowLs, locale)}`,
  );
  if (result.pumpDuty) {
    b.link('main', '').node(
      'pump',
      t('POMPA', 'PUMP'),
      `${n(result.pumpDuty.flowM3h, locale)} ${t('m³/jam', 'm³/h')} @ ${n(result.pumpDuty.headM, locale)} m`,
    );
  }
  b.link('main', pipe(result.recommendedSize, input.family)).node(
    'pipe',
    t('PIPA DISTRIBUSI UTAMA', 'MAIN DISTRIBUTION'),
    `${n(input.routeLengthM, locale)} m`,
    true,
  );
  if (result.alternativeSize) {
    b.link('branch', pipe(result.alternativeSize, input.family)).node(
      'zone',
      t('CABANG', 'BRANCHES'),
      t('per blok', 'per block'),
    );
  }
  const shown = Math.min(result.connections, 4);
  return finish(
    b,
    {
      title: t(`${result.connections} SAMBUNGAN RUMAH`, `${result.connections} HOUSE CONNECTIONS`),
      items: Array.from({ length: shown }, (_, i) => ({
        label:
          i === shown - 1 && result.connections > shown
            ? `+${result.connections - shown + 1}`
            : t(`Rumah ${i + 1}`, `House ${i + 1}`),
      })),
      connection: '',
    },
    t('SK-04 CLUSTER', 'SK-04 CLUSTER'),
    t('KEBUTUHAN PUNCAK', 'PEAK DEMAND') + ` ${n(result.peakFlowLs, locale)} L/S`,
    catalogVersionLabel,
  );
}

// ── Irigasi ─────────────────────────────────────────────────────────────────

export function irrigationSchematic(
  input: IrrigationInput,
  result: IrrigationResult,
  catalogVersionLabel: string,
  locale: EngineeringLocale,
): FlowSchematicShape {
  const t = (id: string, en: string) => T(locale, id, en);
  const method = {
    flood: t('genangan', 'flood'),
    sprinkler: 'sprinkler',
    drip: t('tetes', 'drip'),
  }[input.method];
  const b = builder(result.overallProvenance).node(
    'source',
    t('SUMBER AIR', 'WATER SOURCE'),
    flowOf(result.designFlowLs, locale),
  );
  if (result.pumpRequired) b.link('main', '').node('pump', t('POMPA', 'PUMP'));
  b.link('main', pipe(result.mainSize, result.mainFamily))
    .node('pipe', t('PIPA UTAMA', 'MAIN LINE'), `${n(input.mainRunMeters, locale)} m`, true)
    .link('branch', pipe(result.distributionSize, result.distributionFamily))
    .node(
      'pipe',
      t('PIPA DISTRIBUSI', 'DISTRIBUTION'),
      `${n(result.distributionMeters, locale)} m`,
      true,
    )
    .link('branch', '')
    .node('area', t('LAHAN', 'FIELD'), `${n(input.areaHa, locale)} ha · ${method}`);
  return finish(
    b,
    null,
    t('SK-05 IRIGASI', 'SK-05 IRRIGATION'),
    t('DEBIT', 'FLOW') + ` ${n(result.designFlowLs, locale)} L/S`,
    catalogVersionLabel,
  );
}

// ── Gravitasi: drainase, air hujan, gorong-gorong ───────────────────────────

export function gravitySchematic(
  input: { readonly pipeLengthM: number | null; readonly catchmentHa?: number },
  result: GravityResult,
  catalogVersionLabel: string,
  locale: EngineeringLocale,
): FlowSchematicShape {
  const t = (id: string, en: string) => T(locale, id, en);
  const head =
    result.kind === 'stormwater'
      ? [
          t('AREA TANGKAPAN', 'CATCHMENT'),
          input.catchmentHa !== undefined ? `${n(input.catchmentHa, locale)} ha` : undefined,
        ]
      : result.kind === 'culvert'
        ? [t('SALURAN HULU', 'UPSTREAM CHANNEL'), undefined]
        : [t('TITIK MASUK', 'INLET'), undefined];
  const length = input.pipeLengthM !== null ? ` · ${n(input.pipeLengthM, locale)} m` : '';
  const pipeTitle =
    result.kind === 'culvert' ? t('GORONG-GORONG', 'CULVERT') : t('PIPA SALURAN', 'DRAIN PIPE');
  const pipeDetail =
    result.kind === 'culvert' && result.structural
      ? `${t('timbunan min.', 'min. cover')} ${n(result.structural.minimumCoverM, locale)} m${length}`
      : `${t('kemiringan', 'slope')} ${n(result.slopePercent, locale)} %${length}`;
  const b = builder(result.overallProvenance)
    .node('source', head[0]!, head[1] ?? flowOf(result.designFlowLs, locale))
    .link('drain', pipe(result.recommendedSize, 'PVC D'))
    .node('pipe', pipeTitle, pipeDetail, true)
    .link('drain', '')
    .node(
      'outlet',
      result.kind === 'culvert' ? t('SALURAN HILIR', 'DOWNSTREAM') : t('PEMBUANGAN', 'OUTFALL'),
      `${n(result.utilisationPercent, locale)} % ${t('kapasitas', 'capacity')}`,
    );
  const drawing =
    result.kind === 'stormwater'
      ? t('SK-06 AIR HUJAN', 'SK-06 STORMWATER')
      : result.kind === 'culvert'
        ? t('SK-07 GORONG-GORONG', 'SK-07 CULVERT')
        : t('SK-06 DRAINASE', 'SK-06 DRAINAGE');
  return finish(
    b,
    null,
    drawing,
    t('DEBIT', 'FLOW') + ` ${n(result.designFlowLs, locale)} L/S`,
    catalogVersionLabel,
  );
}

// ── Gedung bertingkat ───────────────────────────────────────────────────────

export function buildingWaterSchematic(
  input: { readonly floors: number },
  result: BuildingWaterResult,
  catalogVersionLabel: string,
  locale: EngineeringLocale,
): FlowSchematicShape {
  const t = (id: string, en: string) => T(locale, id, en);
  const fam = (m: string) => (m === 'PVC' ? 'PVC AW' : m);
  const pump = result.transfer.pumpDuty;
  const z = result.zoning;
  const b = builder(result.overallProvenance)
    .node(
      'tank',
      t('TANGKI BAWAH', 'GROUND TANK'),
      `${n(result.demand.dailyM3, locale)} ${t('m³/hari', 'm³/day')}`,
    )
    .link('main', '')
    .node(
      'pump',
      t('POMPA TRANSFER', 'TRANSFER PUMP'),
      pump
        ? `${n(pump.flowM3h, locale)} ${t('m³/jam', 'm³/h')} @ ${n(pump.headM, locale)} m`
        : undefined,
    )
    .link('main', pipe(result.transfer.recommendedSize, fam(result.transferMaterial)))
    .node('pipe', t('PIPA TRANSFER', 'TRANSFER PIPE'), `${n(z.buildingHeightM, locale)} m`, true)
    .link('main', '')
    .node('tank', t('TANGKI ATAP', 'ROOF TANK'), `+${n(z.buildingHeightM, locale)} m`)
    .link(
      'riser',
      `${result.risers} × ${pipe(result.riser.recommendedSize, fam(result.riserMaterial))}`,
    )
    .node(
      'pipe',
      t('RISER DISTRIBUSI', 'DISTRIBUTION RISER'),
      flowOf(result.demand.peakMinuteLs, locale),
      true,
    );
  if (z.boosterFloors > 0) {
    b.link('riser', '').node(
      'pump',
      t('BOOSTER', 'BOOSTER'),
      t(`${z.boosterFloors} lantai teratas`, `top ${z.boosterFloors} floors`),
    );
  }
  b.link('riser', '').node(
    'zone',
    t(`${z.zones} ZONA TEKANAN`, `${z.zones} PRESSURE ZONES`),
    z.reducedZones > 0
      ? t(
          `${z.reducedZones} zona bawah dengan katup penurun tekanan`,
          `${z.reducedZones} lower zone(s) with PRVs`,
        )
      : t(`${input.floors} lantai`, `${input.floors} floors`),
  );
  const floor = result.floorBranch;
  if (floor !== null) {
    b.link('branch', pipe(floor.header.recommendedSize, fam(result.riserMaterial))).node(
      'zone',
      t('TIAP LANTAI', 'EACH FLOOR'),
      t(
        `${floor.outletsPerFloor} titik · ${floor.branchesPerFloor} cabang`,
        `${floor.outletsPerFloor} outlets · ${floor.branchesPerFloor} branches`,
      ),
    );
  }
  return finish(
    b,
    floor !== null
      ? {
          title: t('TITIK AIR PER LANTAI', 'OUTLETS PER FLOOR'),
          items: [
            { label: t('Kamar mandi', 'Bathroom'), detail: floor.fixtureConnectionSize },
            { label: t('Wastafel', 'Basin'), detail: floor.fixtureConnectionSize },
          ],
          connection: floor.fixtureConnectionSize,
        }
      : null,
    t('SK-08 GEDUNG', 'SK-08 BUILDING'),
    t(`${input.floors} LANTAI · ${z.zones} ZONA`, `${input.floors} FLOORS · ${z.zones} ZONES`),
    catalogVersionLabel,
  );
}
