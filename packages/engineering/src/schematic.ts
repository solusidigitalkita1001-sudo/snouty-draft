/**
 * Pembentukan topologi skema. docs/SCHEMATIC_ENGINE.md §3. **Fungsi murni.**
 *
 * Tujuh langkah di §3 dijalankan apa adanya dari requirement state dan keluaran engine.
 * Karena topologi dan tabel sistem keluar dari sumber yang sama, keduanya tidak bisa
 * bertentangan — dan itulah alasan pemisahan topologi/renderer ada sejak awal.
 *
 * Batas 3 lantai pada prototipe **tidak** dibawa: itu keterbatasan rendering, bukan
 * aturan teknik (OQ-33). Bangunan 5 lantai menghasilkan 5 lantai, dan renderer yang
 * menyesuaikan diri.
 *
 * Paket ini tidak boleh bergantung pada `@snouty/shared-types` (nol dependensi runtime),
 * jadi tipe topologinya dideklarasikan ulang di sini secara struktural. Keduanya
 * dicocokkan oleh tes di sisi API — duplikasi yang sengaja, demi pagar isolasi yang
 * membuat SPEC §25 benar secara struktural.
 */

import type { Provenance } from './provenance.js';
import type { FloorNode } from './rules/group-b-geometry.js';

export interface TrackedNumber {
  readonly value: number | null;
  readonly provenance: Provenance;
  readonly source: 'user_stated' | 'user_edited' | 'default_applied' | 'inferred';
  readonly reason?: string;
  readonly ruleId?: string;
  readonly updatedAt: string;
}

export interface SchematicFloorShape {
  readonly level: number;
  readonly label: string;
  readonly shortLabel: string;
  readonly elevation: TrackedNumber;
  readonly elevationLabel: string;
}

export interface SchematicNodeShape {
  readonly id: string;
  readonly type: 'water_source' | 'riser' | 'branch' | 'fixture' | 'fitting';
  readonly floorLevel: number | 'roof';
  readonly code?: string;
  readonly label?: string;
  readonly size?: string;
  readonly provenance: Provenance;
}

export interface SchematicSegmentShape {
  readonly from: string;
  readonly to: string;
  readonly role: 'main' | 'riser' | 'branch' | 'fixture_connection';
  readonly size: string;
  readonly provenance: Provenance;
}

export interface SchematicShape {
  readonly floors: readonly SchematicFloorShape[];
  readonly nodes: readonly SchematicNodeShape[];
  readonly segments: readonly SchematicSegmentShape[];
  readonly groundLevel: '±0.00';
  readonly titleBlock: {
    readonly drawing: 'SK-01 AIR BERSIH';
    readonly scale: 'NTS';
    readonly floorHeight: string;
    readonly source: string;
  };
}

export interface BuildSchematicInput {
  readonly floors: number;
  readonly floorHeightM: number;
  /** Apakah tinggi lantai memakai default ENG-004 — menentukan provenance elevasi. */
  readonly floorHeightIsDefault: boolean;
  readonly waterSource: 'rooftop_tank' | 'ground_tank' | 'pump' | 'municipal';
  readonly mainSize: string;
  readonly branchSize: string;
  readonly fixtureSize: string;
  readonly floorsPlan: readonly FloorNode[];
  /** Provenance keseluruhan dari engine — seluruh node mewarisinya. */
  readonly provenance: Provenance;
  readonly catalogVersionLabel: string;
  readonly now: string;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function buildSchematic(input: BuildSchematicInput): SchematicShape {
  const nodes: SchematicNodeShape[] = [];
  const segments: SchematicSegmentShape[] = [];
  const provenance = input.provenance;

  // 1 + 6 — lantai dan elevasinya. Elevasi ikut ASSUMED bila tinggi lantai default.
  const elevationProvenance: Provenance = input.floorHeightIsDefault ? 'ASSUMED' : provenance;
  const floors: SchematicFloorShape[] = [];
  for (let level = input.floors; level >= 1; level -= 1) {
    const elevation = (level - 1) * input.floorHeightM;
    floors.push({
      level,
      label: `LANTAI ${level}`,
      shortLabel: `LT ${level}`,
      elevation: {
        value: elevation,
        provenance: elevationProvenance,
        source: input.floorHeightIsDefault ? 'default_applied' : 'user_stated',
        ...(input.floorHeightIsDefault ? { ruleId: 'ENG-004' } : {}),
        updatedAt: input.now,
      },
      elevationLabel: elevation === 0 ? '±0.00' : `+${elevation.toFixed(2)}`,
    });
  }

  // 2 — sumber air. Toren atap duduk di level 'roof'; pompa/PDAM di lantai 1.
  const sourceOnRoof = input.waterSource === 'rooftop_tank';
  const sourceId = 'src';
  nodes.push({
    id: sourceId,
    type: 'water_source',
    floorLevel: sourceOnRoof ? 'roof' : 1,
    code: sourceOnRoof ? 'TR-1' : 'SM-1',
    label: SOURCE_LABEL[input.waterSource],
    provenance,
  });

  // 3 + 4 — segmen main ke pangkal riser, lalu riser vertikal melalui semua lantai.
  const riserIdFor = (level: number): string => `riser-${level}`;
  const topLevel = input.floors;

  nodes.push({
    id: riserIdFor(topLevel),
    type: 'riser',
    floorLevel: topLevel,
    size: input.mainSize,
    provenance,
  });
  segments.push({
    from: sourceId,
    to: riserIdFor(topLevel),
    role: 'main',
    size: input.mainSize,
    provenance,
  });

  for (let level = topLevel - 1; level >= 1; level -= 1) {
    nodes.push({
      id: riserIdFor(level),
      type: 'riser',
      floorLevel: level,
      size: input.mainSize,
      provenance,
    });
    segments.push({
      from: riserIdFor(level + 1),
      to: riserIdFor(level),
      role: 'riser',
      size: input.mainSize,
      provenance,
    });
  }

  // 5 — per lantai: reducer di titik percabangan, node branch, lalu titik air.
  for (const plan of input.floorsPlan) {
    const level = plan.floor;
    const reducerId = `red-${level}`;
    const branchId = `br-${level}`;

    nodes.push({
      id: reducerId,
      type: 'fitting',
      floorLevel: level,
      code: `RD-${level}`,
      label: `Reducer ${input.mainSize}→${input.branchSize}`,
      size: input.branchSize,
      provenance,
    });
    segments.push({
      from: riserIdFor(level),
      to: reducerId,
      role: 'branch',
      size: input.branchSize,
      provenance,
    });

    nodes.push({
      id: branchId,
      type: 'branch',
      floorLevel: level,
      size: input.branchSize,
      provenance,
    });
    segments.push({
      from: reducerId,
      to: branchId,
      role: 'branch',
      size: input.branchSize,
      provenance,
    });

    // Penamaan kode mengikuti desain: KM-<lantai><huruf>, WF-<lantai>, DP-<lantai>.
    for (let i = 0; i < plan.bathrooms; i += 1) {
      addFixture(`KM-${level}${ALPHABET[i] ?? String(i + 1)}`, 'Kamar mandi');
    }
    if (plan.basins > 0) {
      addFixture(`WF-${level}`, plan.basins > 1 ? `Wastafel ×${plan.basins}` : 'Wastafel');
    }
    if (plan.kitchens > 0) {
      addFixture(`DP-${level}`, plan.kitchens > 1 ? `Dapur ×${plan.kitchens}` : 'Dapur');
    }

    function addFixture(code: string, label: string): void {
      const id = `fx-${code}`;
      nodes.push({
        id,
        type: 'fixture',
        floorLevel: level,
        code,
        label,
        size: input.fixtureSize,
        provenance,
      });
      segments.push({
        from: branchId,
        to: id,
        role: 'fixture_connection',
        size: input.fixtureSize,
        provenance,
      });
    }
  }

  return {
    floors,
    nodes,
    segments,
    groundLevel: '±0.00',
    titleBlock: {
      drawing: 'SK-01 AIR BERSIH',
      scale: 'NTS',
      // Provenance ikut tampil DI DALAM gambar — perilaku prototipe, dipertahankan.
      floorHeight: `${input.floorHeightM.toFixed(2).replace('.', ',')} M${
        input.floorHeightIsDefault ? ' · ASUMSI' : ''
      }`,
      source: `KATALOG ${input.catalogVersionLabel}`,
    },
  };
}

const SOURCE_LABEL: Readonly<Record<BuildSchematicInput['waterSource'], string>> = {
  rooftop_tank: 'Toren atap',
  ground_tank: 'Toren bawah',
  pump: 'Pompa',
  municipal: 'PDAM',
};
