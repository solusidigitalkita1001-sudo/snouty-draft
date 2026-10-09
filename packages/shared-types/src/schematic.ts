/**
 * Topologi skema — **struktur, bukan gambar**. docs/SCHEMATIC_ENGINE.md §2 · SPEC §13.
 *
 * Tidak ada gambar hasil generasi AI yang diperlakukan sebagai kebenaran teknik. Skema
 * dibentuk deterministik dari requirement state dan keluaran engine; renderer membaca
 * topologi ini dan **tidak menambahkan informasi apa pun**. Karena sumbernya sama dengan
 * tabel sistem dan BOM, gambar tidak bisa bertentangan dengan keduanya.
 *
 * Elevasi adalah `TrackedValue`: bila tinggi lantai memakai default ENG-004, seluruh
 * elevasi yang diturunkan darinya bersifat `ASSUMED` — dan itu ikut tampil di blok judul
 * gambar, bukan hanya di tabel.
 */

import type { Provenance, TrackedValue } from './provenance.js';

export interface SchematicFloor {
  /** 1 = lantai dasar. */
  readonly level: number;
  readonly label: string;
  readonly shortLabel: string;
  readonly elevation: TrackedValue<number>;
  /** "+3.50" / "±0.00" — format desain. */
  readonly elevationLabel: string;
}

export type SchematicNodeType = 'water_source' | 'riser' | 'branch' | 'fixture' | 'fitting';

export interface SchematicNode {
  readonly id: string;
  readonly type: SchematicNodeType;
  readonly floorLevel: number | 'roof';
  /** "KM-2A", "WF-1", "DP-1" — penamaan dari desain. */
  readonly code?: string;
  readonly label?: string;
  readonly size?: string;
  readonly provenance: Provenance;
}

export type SegmentRole = 'main' | 'riser' | 'branch' | 'fixture_connection';

export interface SchematicSegment {
  readonly from: string;
  readonly to: string;
  readonly role: SegmentRole;
  readonly size: string;
  readonly productId?: string;
  readonly lengthM?: TrackedValue<number>;
  readonly provenance: Provenance;
}

/**
 * Blok judul gambar teknik. **Bukan hiasan:** prototipe menggambarnya, dan isian tinggi
 * lantainya berbunyi "3,50 M · ASUMSI" — provenance muncul di dalam gambar.
 */
export interface SchematicTitleBlock {
  readonly drawing: 'SK-01 AIR BERSIH';
  readonly scale: 'NTS';
  readonly floorHeight: string;
  readonly source: string;
}

export interface Schematic {
  readonly floors: readonly SchematicFloor[];
  readonly nodes: readonly SchematicNode[];
  readonly segments: readonly SchematicSegment[];
  readonly groundLevel: '±0.00';
  readonly titleBlock: SchematicTitleBlock;
}

/**
 * Skema ALIRAN untuk kasus teknis (kolam, transfer pompa, sumur, cluster, irigasi, drainase, air
 * hujan, gorong-gorong, gedung bertingkat) — kembaran struktural `FlowSchematicShape` di
 * `@snouty/engineering` (paket itu tidak boleh bergantung pada paket ini). Digambar sebagai rel
 * vertikal desain layar 09; `links[i]` menghubungkan `nodes[i]` dan `nodes[i + 1]`.
 */
export type FlowNodeType =
  'source' | 'pump' | 'tank' | 'pipe' | 'pond' | 'zone' | 'area' | 'outlet';
export type FlowLinkRole = 'main' | 'riser' | 'branch' | 'drain' | 'fixture_connection';

export interface FlowNode {
  readonly id: string;
  readonly type: FlowNodeType;
  readonly title: string;
  readonly detail?: string;
  readonly highlighted: boolean;
  readonly provenance: Provenance;
}

export interface FlowLink {
  readonly role: FlowLinkRole;
  readonly label: string;
  readonly provenance: Provenance;
}

export interface FlowLeaves {
  readonly title: string;
  readonly items: readonly { readonly label: string; readonly detail?: string }[];
  readonly connection: string;
}

export interface FlowSchematic {
  readonly kind: 'flow';
  readonly nodes: readonly FlowNode[];
  readonly links: readonly FlowLink[];
  readonly leaves: FlowLeaves | null;
  readonly titleBlock: {
    readonly drawing: string;
    readonly scale: 'NTS';
    readonly basis: string;
    readonly source: string;
  };
}

/** Respons endpoint skema: bangunan (lantai per lantai) atau aliran (kasus teknis). */
export type AnySchematic = Schematic | FlowSchematic;

export function isFlowSchematic(schematic: AnySchematic): schematic is FlowSchematic {
  return 'kind' in schematic && schematic.kind === 'flow';
}
