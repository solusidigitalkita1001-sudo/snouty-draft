/**
 * Skema aliran per kasus: dibentuk dari hasil hitungan — setiap ukuran di jalur adalah ukuran
 * hasil engine, jumlah jalur = simpul − 1, provenance mengikuti hasil (tidak pernah VERIFIED
 * untuk aturan yang menunggu validasi).
 */
import { describe, expect, it } from 'vitest';
import { computeBuildingWater } from './compute-building.js';
import { computeGravity } from './compute-gravity.js';
import { computeIrrigation } from './compute-irrigation.js';
import { computeNetwork } from './compute-network.js';
import { computePond } from './compute-pond.js';
import { computePressurized } from './compute-pressurized.js';
import {
  buildingWaterSchematic,
  gravitySchematic,
  irrigationSchematic,
  networkSchematic,
  pondSchematic,
  pressurizedSchematic,
  type FlowSchematicShape,
} from './schematic-flow.js';

function consistent(s: FlowSchematicShape) {
  expect(s.kind).toBe('flow');
  expect(s.links).toHaveLength(s.nodes.length - 1);
  expect(new Set(s.nodes.map((node) => node.id)).size).toBe(s.nodes.length);
  expect(s.nodes.every((node) => node.provenance !== 'VERIFIED')).toBe(true);
  expect(s.titleBlock.source).toBe('KATALOG ERP-2026-10-06');
}
const LABEL = 'erp-2026-10-06';

describe('skema aliran', () => {
  it('kolam 4 × 4: masuk PVC AW dan kuras PVC D dari hasil hitungan', () => {
    const input = { lengthM: 4, widthM: 4 };
    const result = computePond(input);
    const s = pondSchematic(input, result, LABEL, 'id');
    consistent(s);
    expect(s.links.map((l) => l.label)).toContain(`${result.inletSize} · PVC AW`);
    expect(s.links.map((l) => l.label)).toContain(`${result.drainSize} · PVC D`);
    expect(s.nodes.find((x) => x.type === 'pond')!.detail).toContain('4 × 4');
  });

  it('sumur: pompa muncul bila ada titik kerja, toren di ujung', () => {
    const line = { designFlowLs: 1, routeLengthM: 60, staticHeadM: 70 };
    const result = computePressurized(line);
    const s = pressurizedSchematic(
      { kind: 'well_distribution', ...line, family: 'PVC AW' },
      result,
      LABEL,
      'id',
    );
    consistent(s);
    expect(s.nodes.map((x) => x.type)).toEqual(['source', 'pump', 'pipe', 'tank']);
    expect(s.nodes[0]!.title).toBe('SUMUR');
    expect(s.links[1]!.label).toBe(`${result.recommendedSize} · PVC AW`);
  });

  it('cluster 120 unit: distribusi utama + deret sambungan rumah', () => {
    const result = computeNetwork({ connections: 120, routeLengthM: 500, staticHeadM: 5 });
    const s = networkSchematic({ routeLengthM: 500, family: 'PVC AW' }, result, LABEL, 'id');
    consistent(s);
    expect(s.leaves!.title).toBe('120 SAMBUNGAN RUMAH');
    expect(s.leaves!.items).toHaveLength(4);
    expect(s.leaves!.items[3]!.label).toBe('+117');
  });

  it('irigasi: jalur utama dan distribusi berlabel ukuran engine', () => {
    const input = {
      areaHa: 1,
      method: 'sprinkler' as const,
      mainRunMeters: 150,
      elevation: 'level' as const,
    };
    const result = computeIrrigation(input);
    const s = irrigationSchematic(input, result, LABEL, 'id');
    consistent(s);
    expect(s.links.map((l) => l.label)).toEqual(
      expect.arrayContaining([
        `${result.mainSize} · ${result.mainFamily}`,
        `${result.distributionSize} · PVC AW`,
      ]),
    );
    expect(s.nodes[s.nodes.length - 1]!.detail).toBe('1 ha · sprinkler');
  });

  it('drainase, air hujan, gorong-gorong: PVC D dan judul gambar per jenis', () => {
    const drain = computeGravity({ kind: 'drainage', designFlowLs: 20, slopePercent: 1 });
    const d = gravitySchematic({ pipeLengthM: 30 }, drain, LABEL, 'id');
    consistent(d);
    expect(d.links[0]!.label).toBe(`${drain.recommendedSize} · PVC D`);
    expect(d.titleBlock.drawing).toBe('SK-06 DRAINASE');
    const storm = computeGravity({ kind: 'stormwater', catchmentHa: 0.5, rainfallMmPerHour: 100 });
    expect(
      gravitySchematic({ pipeLengthM: null, catchmentHa: 0.5 }, storm, LABEL, 'id').nodes[0],
    ).toMatchObject({
      title: 'AREA TANGKAPAN',
      detail: '0,5 ha',
    });
    const culvert = computeGravity({ kind: 'culvert', designFlowLs: 50, trafficLoad: 'car' });
    const c = gravitySchematic({ pipeLengthM: 8 }, culvert, LABEL, 'id');
    expect(c.titleBlock.drawing).toBe('SK-07 GORONG-GORONG');
    expect(c.nodes[1]!.title).toBe('GORONG-GORONG');
  });

  it('gedung 12 lantai: tangki bawah → pompa → transfer → tangki atap → riser → booster → zona → lantai', () => {
    const result = computeBuildingWater({
      floors: 12,
      floorAreaM2: 3000,
      bathroomsPerFloor: 6,
      basinsPerFloor: 4,
    });
    const s = buildingWaterSchematic({ floors: 12 }, result, LABEL, 'id');
    consistent(s);
    expect(s.nodes.map((x) => x.title)).toEqual([
      'TANGKI BAWAH',
      'POMPA TRANSFER',
      'PIPA TRANSFER',
      'TANGKI ATAP',
      'RISER DISTRIBUSI',
      'BOOSTER',
      '2 ZONA TEKANAN',
      'TIAP LANTAI',
    ]);
    expect(s.links[1]!.label).toBe('6" · PVC AW');
    expect(s.links[3]!.label).toBe('2 × 6" · PVC AW');
    expect(s.leaves!.connection).toBe('1/2"');
  });

  it('bahasa Inggris memakai angka yang sama', () => {
    const result = computeBuildingWater({ floors: 12, floorAreaM2: 3000 });
    const id = buildingWaterSchematic({ floors: 12 }, result, LABEL, 'id');
    const en = buildingWaterSchematic({ floors: 12 }, result, LABEL, 'en');
    expect(en.nodes[0]!.title).toBe('GROUND TANK');
    expect(en.links.map((l) => l.label)).toEqual(id.links.map((l) => l.label));
  });
});
