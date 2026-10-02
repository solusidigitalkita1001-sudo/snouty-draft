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
