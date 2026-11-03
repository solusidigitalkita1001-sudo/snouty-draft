/** P33-22: satu daftar pedoman di bawah rekomendasi, dikumpulkan dari langkah dan asumsi. */
import { describe, expect, it } from 'vitest';
import type { Recommendation } from '@snouty/shared-types';
import { citedSources } from './solution-sources';

const recommendation = (over: Partial<Recommendation>): Recommendation =>
  ({ systemLines: [], assumptions: [], ...over }) as unknown as Recommendation;

describe('acuan yang dipakai sebuah hitungan', () => {
  it('menggabungkan sumber langkah dan asumsi, memecah titik koma, tanpa duplikat', () => {
    const sources = citedSources(
      recommendation({
        systemLines: [
          {
            name: 'Pipa utama',
            steps: [
              {
                title: 'Debit',
                text: '',
                source: 'UPC Table A 103.1; IPC Appendix E, Table E103.3(3)',
              },
              { title: 'Ukuran', text: '', source: 'Hazen-Williams (SI)' },
              { title: 'Kecepatan', text: '' },
            ],
          },
        ],
        assumptions: [
          { text: 'Kloset 2,5 unit.', fieldPath: 'design_flow', source: 'UPC Table A 103.1' },
          {
            text: 'Tekanan minimum.',
            fieldPath: 'required_pressure',
            source: 'Noerbambang & Morimura',
          },
          { text: 'Tinggi antar lantai 3,5 m.', fieldPath: 'building.floorHeightM' },
        ],
      } as unknown as Partial<Recommendation>),
    );
    expect(sources).toEqual([
      'UPC Table A 103.1',
      'IPC Appendix E, Table E103.3(3)',
      'Hazen-Williams (SI)',
      'Noerbambang & Morimura',
    ]);
  });

  it('hitungan tanpa satu pun acuan tidak memunculkan daftar kosong', () => {
    expect(citedSources(recommendation({}))).toEqual([]);
  });
});
