/** P17-04: Ringkasan bergambar — gambar bangunan lebih dulu, kebutuhan menempel, alur air kartu sendiri. */
import { render } from '@testing-library/react';
import type { Recommendation } from '@snouty/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { SolutionView } from './solution-view';

vi.mock('../product/product-api', () => ({ loadProduct: vi.fn() }));

const base = {
  id: 'R'.repeat(26),
  headline: 'Pipa utama 1 inci',
  body: 'Toren di atap perlu dibantu pompa.',
  stats: {
    outletCount: 11,
    mainSize: '1"',
    branchCount: 4,
    fixtureConnectionSize: '1/2"',
    productCount: 0,
  },
  systemLines: [],
  products: [],
  bom: [],
  assumptions: [],
  overallProvenance: 'ASSUMED',
  createdAt: '2026-10-13T00:00:00.000Z',
};
const withNeeds = {
  ...base,
  needs: [
    { kind: 'building', count: 2, building: { type: 'residential', floors: 2, floorHeightM: 3.5 } },
    {
      kind: 'bathroom',
      count: 3,
      perFloor: [
        { floor: 2, count: 2 },
        { floor: 1, count: 1 },
      ],
    },
    { kind: 'rooftop_tank', count: 1 },
  ],
} as unknown as Recommendation;

describe('Ringkasan bergambar', () => {
  it('gambar bangunan mendahului judul; kartu kebutuhan di kartu yang sama; alur air kartu terpisah', () => {
    const { container } = render(<SolutionView recommendation={withNeeds} tab="ringkasan" />);
    const first = container.querySelector('section')!;
    const hero = first.querySelector('[class*="hero"]')!;
    expect(hero.firstElementChild!.tagName.toLowerCase()).toBe('svg');
    expect(hero.textContent).toContain('Rumah tinggal · 2 lantai · 3,5 m per lantai');
    expect(first.textContent).toContain('Kamar mandi');
    // Bangunan tidak diulang sebagai kartu kebutuhan.
    expect(first.querySelectorAll('[class*="needCount"]')).toHaveLength(2);
    const sections = [...container.querySelectorAll('section')];
    expect(sections[1]!.textContent).toContain('Alur air');
    expect(first.querySelector('section')).toBeNull();
  });

  it('rekomendasi lama tanpa needs: ringkasan teks seperti sebelumnya', () => {
    const { container } = render(
      <SolutionView recommendation={base as unknown as Recommendation} tab="ringkasan" />,
    );
    expect(container.querySelector('[class*="hero"]')).toBeNull();
    expect(container.textContent).toContain('Pipa utama 1 inci');
  });
});

describe('banner data di luar kewajaran (review putaran 4, 6b)', () => {
  it('tampil di atas Ringkasan, bukan hanya di tabel Asumsi', () => {
    const text =
      'Data di luar kewajaran, mohon diverifikasi: Bangunan 2 × 2 m 2 lantai untuk 6 kamar mandi.';
    const rec = {
      ...withNeeds,
      assumptions: [{ text, fieldPath: 'building.dimensions', needsVerification: true }],
    } as unknown as Recommendation;
    const { container } = render(<SolutionView recommendation={rec} tab="ringkasan" />);
    const first = container.querySelector('section')!;
    expect(first.firstElementChild!.textContent).toBe(text);
    expect(first.firstElementChild!.getAttribute('role')).toBe('status');
  });
});
