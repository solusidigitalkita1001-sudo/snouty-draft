/**
 * P26-14 — batang: trek dan isinya benar-benar tergambar (dulu grid bertumpuk membuatnya terjepit,
 * laporan pemilik 2026-10-21), lebar mengikuti nilai, dan deret berurutan mendapat gradasi.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarList } from './charts';

const SLICES = [
  { key: 'aware', label: 'Aware', detail: 'Kenal', value: 1 },
  { key: 'ask', label: 'Ask', detail: 'Menimbang', value: 8 },
  { key: 'act', label: 'Act', detail: 'Bertindak', value: 0 },
];

function fills(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>('li span[class*="chartBarFill"]')];
}

describe('BarList (P26-14)', () => {
  it('setiap batang punya isian; lebarnya sebanding dengan nilai terbesar', () => {
    const { container } = render(<BarList slices={SLICES} />);
    const widths = fills(container).map((el) => el.style.width);
    expect(widths).toHaveLength(3);
    expect(widths[1]).toBe('100%');
    expect(parseFloat(widths[0] ?? '0')).toBeCloseTo(12.5, 1);
    // Nol tetap digambar tipis supaya barisnya tidak terlihat rusak.
    expect(parseFloat(widths[2] ?? '0')).toBeGreaterThan(0);
  });

  it('deret bergradasi memberi satu langkah warna per urutan', () => {
    const { container } = render(<BarList slices={SLICES} graded />);
    const classes = [...container.querySelectorAll('li')].map((li) => li.className);
    expect(classes[0]).toMatch(/tone1/);
    expect(classes[1]).toMatch(/tone2/);
    expect(classes[2]).toMatch(/tone3/);
  });

  it('tanpa gradasi tidak ada kelas warna, dan label tetap terbaca', () => {
    const { container } = render(<BarList slices={SLICES} />);
    expect(container.querySelector('li')?.className).not.toMatch(/tone/);
    expect(screen.getByText('Menimbang')).toBeDefined();
  });
});
