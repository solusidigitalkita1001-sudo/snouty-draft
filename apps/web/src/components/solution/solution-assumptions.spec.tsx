/** P17-03 (DD-01 #10): asumsi tampil sebagai tabel per kategori dengan nilai dan asalnya. */
import { render } from '@testing-library/react';
import type { Recommendation } from '@snouty/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { SolutionView } from './solution-view';

vi.mock('../product/product-api', () => ({ loadProduct: vi.fn() }));

const RECOMMENDATION = {
  id: 'R'.repeat(26),
  headline: '',
  body: '',
  stats: {
    outletCount: 0,
    mainSize: '1"',
    branchCount: 0,
    fixtureConnectionSize: '1/2"',
    productCount: 0,
  },
  systemLines: [],
  products: [],
  bom: [],
  assumptions: [
    { text: 'Cara hitungnya: tiap alat menambah beban.', fieldPath: '', ruleId: 'ENG-701' },
    { text: 'Tinggi antar lantai 3,5 m.', fieldPath: 'building.floorHeightM', ruleId: 'ENG-004' },
    {
      text: 'Dudukan toren 1 m di atas atap.',
      fieldPath: 'tank_elevation',
      assumptionId: 'TANK_STAND_1M',
      value: 1,
      unit: 'm',
    },
    {
      text: 'Satu dapur.',
      fieldPath: 'kitchens',
      assumptionId: 'HOUSE_KITCHEN_1',
      value: 1,
      userSet: true,
    },
  ],
  overallProvenance: 'ASSUMED',
  createdAt: '2026-10-13T00:00:00.000Z',
} as unknown as Recommendation;

describe('tabel asumsi berkategori', () => {
  it('urutan kategori tetap; tiap asumsi di kategorinya dengan nilai dan asal', () => {
    render(<SolutionView recommendation={RECOMMENDATION} tab="material" />);
    const rows = [...document.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim()),
    );
    expect(rows.map((r) => r[0])).toEqual([
      'Bangunan',
      'Tinggi antar lantai 3,5 m.',
      'Isi ruangan',
      'Satu dapur.',
      'Sumber air',
      'Dudukan toren 1 m di atas atap.',
      'Teknik',
      'Cara hitungnya: tiap alat menambah beban.',
    ]);
    expect(rows[3]!.slice(1, 3)).toEqual(['1', 'Dari Anda']);
    expect(rows[5]!.slice(1, 3)).toEqual(['1 m', 'Standar']);
    // Baris cara hitung bukan asumsi yang bisa diganti: tanpa asal.
    expect(rows[7]![2]).toBe('');
  });
});
