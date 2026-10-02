/**
 * P9-02a — pembentukan topologi: deterministik, konsisten dengan hasil engine, dan
 * batas 3 lantai prototipe TIDAK dibawa (OQ-33).
 */
import { describe, expect, it } from 'vitest';
import { buildSchematic, type BuildSchematicInput } from './schematic.js';
import { computeSolution, type SolutionInput } from './compute-solution.js';

const SOLUTION_INPUT: SolutionInput = {
  buildingType: 'residential',
  floors: 2,
  bathrooms: 3,
  basins: 4,
  kitchens: 1,
  waterSource: 'rooftop_tank',
  installationType: 'clean_water',
  floorHeightM: null,
  mainRunMeters: null,
};

function inputFrom(over: Partial<BuildSchematicInput> = {}): BuildSchematicInput {
  const solution = computeSolution({
    ...SOLUTION_INPUT,
    ...(over.floors ? { floors: over.floors } : {}),
  });
  return {
    floors: SOLUTION_INPUT.floors,
    floorHeightM: solution.floorHeightM,
    floorHeightIsDefault: true,
    waterSource: 'rooftop_tank',
    mainSize: solution.mainSize,
    branchSize: '3/4"',
    fixtureSize: solution.fixtureConnectionSize,
    floorsPlan: solution.floorsPlan,
    provenance: solution.overallProvenance,
    catalogVersionLabel: 'dev-0.2',
    now: '2026-10-02T00:00:00.000Z',
    ...over,
  };
}

describe('buildSchematic — contoh kerja desain', () => {
  const schematic = buildSchematic(inputFrom());

  it('membuat satu entri lantai per lantai, teratas lebih dulu', () => {
    expect(schematic.floors.map((f) => f.level)).toEqual([2, 1]);
    expect(schematic.floors[0]!.shortLabel).toBe('LT 2');
  });

  it('elevasi lantai dasar ±0.00 dan lantai atas +3.50', () => {
    expect(schematic.floors[1]!.elevationLabel).toBe('±0.00');
    expect(schematic.floors[0]!.elevationLabel).toBe('+3.50');
  });

  it('toren atap duduk di level roof', () => {
    const source = schematic.nodes.find((n) => n.type === 'water_source')!;
    expect(source.floorLevel).toBe('roof');
    expect(source.label).toBe('Toren atap');
  });

  it('pompa dan PDAM duduk di lantai 1, bukan di atap', () => {
    for (const waterSource of ['pump', 'municipal', 'ground_tank'] as const) {
      const source = buildSchematic(inputFrom({ waterSource })).nodes.find(
        (n) => n.type === 'water_source',
      )!;
      expect(source.floorLevel).toBe(1);
    }
  });

  it('riser melewati semua lantai dengan ukuran jalur utama', () => {
    const risers = schematic.nodes.filter((n) => n.type === 'riser');
    expect(risers).toHaveLength(2);
    for (const riser of risers) expect(riser.size).toBe('1"');
  });

  it('segmen main dari sumber ke pangkal riser', () => {
    const main = schematic.segments.find((s) => s.role === 'main')!;
    expect(main.from).toBe('src');
    expect(main.size).toBe('1"');
  });

  it('setiap lantai punya reducer dan cabang', () => {
    expect(schematic.nodes.filter((n) => n.type === 'fitting')).toHaveLength(2);
    expect(schematic.nodes.filter((n) => n.type === 'branch')).toHaveLength(2);
  });

  it('penamaan kode mengikuti desain: KM-2A, WF-1, DP-1', () => {
    const codes = schematic.nodes.filter((n) => n.type === 'fixture').map((n) => n.code);
    expect(codes).toContain('KM-2A');
    expect(codes).toContain('WF-1');
    expect(codes).toContain('DP-1');
  });

  it('dapur hanya di lantai 1 (ENG-008)', () => {
    const kitchen = schematic.nodes.find((n) => n.code?.startsWith('DP-'))!;
    expect(kitchen.floorLevel).toBe(1);
  });

  it('sambungan fixture memakai ukuran 1/2"', () => {
    for (const segment of schematic.segments.filter((s) => s.role === 'fixture_connection')) {
      expect(segment.size).toBe('1/2"');
    }
  });

  it('setiap segmen menunjuk node yang ada — topologi tidak menggantung', () => {
    const ids = new Set(schematic.nodes.map((n) => n.id));
    for (const segment of schematic.segments) {
      expect(ids.has(segment.from), `from ${segment.from}`).toBe(true);
      expect(ids.has(segment.to), `to ${segment.to}`).toBe(true);
    }
  });

  it('jumlah titik air sama dengan hitungan engine — gambar tak bisa bertentangan', () => {
    const solution = computeSolution(SOLUTION_INPUT);
    const fixtureNodes = schematic.nodes.filter((n) => n.type === 'fixture');
    // 3 kamar mandi + 1 node wastafel (×4) + 1 node dapur = 5 node untuk 8 titik air.
    const represented = fixtureNodes.reduce((sum, node) => {
      const multiplier = /×(\d+)/.exec(node.label ?? '');
      return sum + (multiplier ? Number(multiplier[1]) : 1);
    }, 0);
    expect(represented).toBe(solution.outletCount);
  });
});

describe('batas lantai (OQ-33)', () => {
  it('bangunan 5 lantai menghasilkan 5 lantai — batas 3 prototipe tidak dibawa', () => {
    const solution = computeSolution({ ...SOLUTION_INPUT, floors: 5 });
    const schematic = buildSchematic(inputFrom({ floors: 5, floorsPlan: solution.floorsPlan }));
    expect(schematic.floors).toHaveLength(5);
    expect(schematic.nodes.filter((n) => n.type === 'riser')).toHaveLength(5);
  });

  it('satu lantai: tanpa segmen riser antar lantai', () => {
    const solution = computeSolution({ ...SOLUTION_INPUT, floors: 1 });
    const schematic = buildSchematic(inputFrom({ floors: 1, floorsPlan: solution.floorsPlan }));
    expect(schematic.floors).toHaveLength(1);
    expect(schematic.segments.filter((s) => s.role === 'riser')).toHaveLength(0);
  });
});

describe('provenance dan blok judul', () => {
  it('tinggi lantai default: elevasi ASSUMED dan blok judul menyebut ASUMSI', () => {
    const schematic = buildSchematic(inputFrom({ floorHeightIsDefault: true }));
    expect(schematic.floors[0]!.elevation.provenance).toBe('ASSUMED');
    expect(schematic.floors[0]!.elevation.ruleId).toBe('ENG-004');
    expect(schematic.titleBlock.floorHeight).toBe('3,50 M · ASUMSI');
  });

  it('tinggi lantai dari pengguna: blok judul tanpa kata ASUMSI', () => {
    const schematic = buildSchematic(inputFrom({ floorHeightIsDefault: false, floorHeightM: 3 }));
    expect(schematic.titleBlock.floorHeight).toBe('3,00 M');
    expect(schematic.floors[0]!.elevation.ruleId).toBeUndefined();
  });

  it('blok judul memuat gambar, skala, dan versi katalog', () => {
    const schematic = buildSchematic(inputFrom());
    expect(schematic.titleBlock.drawing).toBe('SK-01 AIR BERSIH');
    expect(schematic.titleBlock.scale).toBe('NTS');
    expect(schematic.titleBlock.source).toBe('KATALOG dev-0.2');
  });

  it('seluruh node mewarisi provenance engine (ASSUMED hari ini)', () => {
    const schematic = buildSchematic(inputFrom());
    for (const node of schematic.nodes) expect(node.provenance).toBe('ASSUMED');
    for (const segment of schematic.segments) expect(segment.provenance).toBe('ASSUMED');
  });
});

describe('determinisme', () => {
  it('masukan sama menghasilkan topologi identik', () => {
    expect(JSON.stringify(buildSchematic(inputFrom()))).toBe(
      JSON.stringify(buildSchematic(inputFrom())),
    );
  });
});
