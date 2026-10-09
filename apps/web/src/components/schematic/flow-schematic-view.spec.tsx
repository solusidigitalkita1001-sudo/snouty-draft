/**
 * Skema aliran kasus teknis (pemilik 2026-10-09: "ai ini bisa generate skemanya"): `SchematicView`
 * yang sama merender rel vertikal dari hasil hitungan, dengan invarian S-1 tetap utuh.
 */
import { render, screen } from '@testing-library/react';
import type { FlowSchematic } from '@snouty/shared-types';
import {
  buildingWaterSchematic,
  computeBuildingWater,
  computePond,
  pondSchematic,
} from '@snouty/engineering';
import { describe, expect, it } from 'vitest';
import { MANDATORY_NOTES } from './schematic-copy';
import { SchematicSidePanel, SchematicView } from './schematic-view';

function building(): FlowSchematic {
  const result = computeBuildingWater({
    floors: 12,
    floorAreaM2: 3000,
    bathroomsPerFloor: 6,
    basinsPerFloor: 4,
  });
  return buildingWaterSchematic({ floors: 12 }, result, 'erp-2026-10-06', 'id') as FlowSchematic;
}

describe('FlowSchematicView', () => {
  it('gedung: rel tangki bawah → pompa → transfer → tangki atap → riser, label ukuran dari hitungan', () => {
    render(<SchematicView schematic={building()} />);
    for (const title of [
      'TANGKI BAWAH',
      'POMPA TRANSFER',
      'PIPA TRANSFER',
      'TANGKI ATAP',
      'RISER DISTRIBUSI',
    ]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('6" · PVC AW').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TITIK AIR PER LANTAI').length).toBeGreaterThan(0);
  });

  it('invarian S-1: kedua catatan wajib selalu ada', () => {
    const pond = computePond({ lengthM: 4, widthM: 4 });
    render(
      <SchematicView
        schematic={pondSchematic({ lengthM: 4, widthM: 4 }, pond, 'erp', 'id') as FlowSchematic}
      />,
    );
    expect(screen.getByText(MANDATORY_NOTES.banner)).toBeTruthy();
    expect(screen.getByText(MANDATORY_NOTES.noteTitle)).toBeTruthy();
  });

  it('panel jalur: hanya jalur berukuran, blok judul memakai dasar hitungan', () => {
    render(<SchematicSidePanel schematic={building()} />);
    expect(screen.getByText('SK-08 GEDUNG')).toBeTruthy();
    expect(screen.getByText('12 LANTAI · 2 ZONA')).toBeTruthy();
    expect(screen.getByText('2 × 6" · PVC AW')).toBeTruthy();
  });
});
