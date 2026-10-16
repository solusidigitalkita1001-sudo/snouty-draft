/** P22-04: kartu Tinggi toren — tiap dudukan bergambar, yang cukup ditandai, ukuran pipa disebut. */
import { render } from '@testing-library/react';
import type { TankStandView } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { TankStandCard } from './tank-stand-card';

const view: TankStandView = {
  options: [
    {
      kind: 'roof_slab',
      supportHeightM: 3.5,
      waterLevelM: 4.5,
      residualBar: 0.2,
      meetsMinimum: false,
      comfortable: false,
    },
    {
      kind: 'tower',
      supportHeightM: 4,
      waterLevelM: 5,
      residualBar: 0.25,
      meetsMinimum: false,
      comfortable: false,
    },
    {
      kind: 'tower',
      supportHeightM: 5,
      waterLevelM: 6,
      residualBar: 0.34,
      meetsMinimum: true,
      comfortable: false,
    },
    {
      kind: 'tower',
      supportHeightM: 8,
      waterLevelM: 9,
      residualBar: 0.64,
      meetsMinimum: true,
      comfortable: false,
    },
  ],
  recommendedIndex: 2,
  comfortableIndex: null,
  minimumBar: 0.3,
  comfortBar: 0.7,
  mainSize: '3/4"',
  branchSizes: ['1/2"'],
};

describe('TankStandCard', () => {
  it('menyebut dudukan terendah yang cukup, tiap pilihan dengan tekanannya, dan ukuran pipa', () => {
    const { getByTestId, getByText, getAllByText } = render(<TankStandCard view={view} />);
    expect(getByTestId('tank-stand').textContent).toContain('Tinggi toren');
    expect(getByText(/dudukan terendah yang masih memberi 0,3 bar/).textContent).toContain(
      'tiang toren 5 m',
    );
    expect(getByText('Di dak atap')).toBeTruthy();
    expect(getByText('0,34 bar')).toBeTruthy();
    expect(getAllByText(/kurang, perlu pompa/).length).toBe(2);
    expect(getByText(/Pipa dari toren 3\/4", cabang di dalam rumah 1\/2"/)).toBeTruthy();
    expect(getByText(/perlu pompa pendorong\.$/).textContent).toContain('0,7 bar');
  });

  it('tanpa pilihan yang cukup → kalimat pembuka menyebut tidak ada yang mencapai batas', () => {
    const none = { ...view, recommendedIndex: null, options: view.options.slice(0, 2) };
    const { getByText } = render(<TankStandCard view={none} />);
    expect(getByText(/tidak ada dudukan di daftar yang mencapai 0,3 bar/)).toBeTruthy();
  });
});
