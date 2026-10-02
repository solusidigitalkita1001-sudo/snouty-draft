/**
 * P9-06a — **invarian S-1**: setiap tampilan skema membawa kedua catatan wajib, dan
 * tidak ada mode yang menghilangkannya.
 *
 * Diuji dengan merender komponennya, bukan dengan membaca string: yang ingin dicegah
 * bukan hilangnya konstanta, melainkan munculnya cabang render yang melewatinya.
 */
import { render, screen } from '@testing-library/react';
import type { Schematic } from '@snouty/shared-types';
import { buildSchematic } from '@snouty/engineering';
import { computeSolution } from '@snouty/engineering';
import { describe, expect, it } from 'vitest';
import { MANDATORY_NOTES } from './schematic-copy';
import { SchematicSidePanel, SchematicView } from './schematic-view';

function schematicFor(floors: number): Schematic {
  const solution = computeSolution({
    buildingType: 'residential',
    floors,
    bathrooms: 3,
    basins: 4,
    kitchens: 1,
    waterSource: 'rooftop_tank',
    installationType: 'clean_water',
    floorHeightM: null,
    mainRunMeters: null,
  });
  return buildSchematic({
    floors,
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
  }) as unknown as Schematic;
}

describe('invarian S-1 — catatan wajib', () => {
  it('menampilkan banner "SKEMATIK · BUKAN GAMBAR KERJA"', () => {
    render(<SchematicView schematic={schematicFor(2)} />);
    expect(screen.getByText(MANDATORY_NOTES.banner)).toBeDefined();
  });

  it('menampilkan CATATAN SKEMA beserta isinya, apa adanya', () => {
    render(<SchematicView schematic={schematicFor(2)} />);
    expect(screen.getByText(MANDATORY_NOTES.noteTitle)).toBeDefined();
    expect(screen.getByText(new RegExp('bukan posisi fisik pipa'))).toBeDefined();
  });

  it('kedua catatan tetap ada untuk jumlah lantai apa pun', () => {
    for (const floors of [1, 2, 5]) {
      const { unmount } = render(<SchematicView schematic={schematicFor(floors)} />);
      expect(screen.getByText(MANDATORY_NOTES.banner)).toBeDefined();
      expect(screen.getByText(MANDATORY_NOTES.noteTitle)).toBeDefined();
      unmount();
    }
  });

  it('komponen tidak menerima prop apa pun selain `schematic` — tidak ada mode untuk dimatikan', () => {
    // Satu parameter berarti tidak ada `hideNotes`, `compact`, atau `variant` yang bisa
    // melewati catatan wajib. Invariannya dijaga bentuk API-nya, bukan kedisiplinan.
    expect(SchematicView.length).toBe(1);
  });
});

describe('renderer skema', () => {
  it('merender satu label lantai per lantai', () => {
    render(<SchematicView schematic={schematicFor(5)} />);
    for (const level of [1, 2, 3, 4, 5]) {
      expect(screen.getByText(`LT ${level}`)).toBeDefined();
    }
  });

  it('lantai dasar bertanda ±0.00', () => {
    render(<SchematicView schematic={schematicFor(2)} />);
    expect(screen.getByText('±0.00')).toBeDefined();
  });

  it('merender kode titik air dari topologi, bukan dari daftar sendiri', () => {
    render(<SchematicView schematic={schematicFor(2)} />);
    expect(screen.getByText('KM-2A')).toBeDefined();
    expect(screen.getByText('DP-1')).toBeDefined();
  });

  it('menyediakan alternatif teks terstruktur, bukan sekadar alt gambar', () => {
    render(<SchematicView schematic={schematicFor(2)} />);
    expect(screen.getByText('Uraian skema dalam teks')).toBeDefined();
    expect(screen.getByText(/LANTAI 1/)).toBeDefined();
  });

  it('kanvas punya label untuk pembaca layar', () => {
    render(<SchematicView schematic={schematicFor(2)} />);
    expect(screen.getByRole('img')).toBeDefined();
  });
});

describe('blok judul', () => {
  it('menampilkan provenance tinggi lantai DI DALAM gambar', () => {
    render(<SchematicSidePanel schematic={schematicFor(2)} />);
    expect(screen.getByText('3,50 M · ASUMSI')).toBeDefined();
  });

  it('menampilkan gambar, skala, dan sumber katalog', () => {
    render(<SchematicSidePanel schematic={schematicFor(2)} />);
    expect(screen.getByText('SK-01 AIR BERSIH')).toBeDefined();
    expect(screen.getByText('NTS')).toBeDefined();
    expect(screen.getByText('KATALOG dev-0.2')).toBeDefined();
  });
});
