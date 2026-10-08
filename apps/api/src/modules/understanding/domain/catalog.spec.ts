/**
 * Katalog contoh: label di luar kosakata kode ditolak; contoh yang sama di dua label ditolak —
 * contoh yang tidak pernah berbuah apa pun harus ketahuan saat boot, bukan diam.
 */
import { describe, expect, it } from 'vitest';
import { CatalogSchema, catalogIssues, examplesOf } from './catalog.js';

describe('catalog', () => {
  it('skema: nama kebab-case, ambang 0..1, label berisi minimal satu contoh', () => {
    const catalog = CatalogSchema.parse({
      name: 'intent',
      threshold: 0.6,
      labels: { greeting: ['hai'] },
    });
    expect(catalog.margin).toBe(0);
    expect(catalog.multi).toBe(false);
    expect(() => CatalogSchema.parse({ name: 'Intent', threshold: 0.6, labels: {} })).toThrow();
    expect(() =>
      CatalogSchema.parse({ name: 'intent', threshold: 1.5, labels: { greeting: ['hai'] } }),
    ).toThrow();
    expect(() =>
      CatalogSchema.parse({ name: 'intent', threshold: 0.6, labels: { greeting: [] } }),
    ).toThrow();
  });

  it('examplesOf meratakan label → contoh', () => {
    const catalog = CatalogSchema.parse({
      name: 'depth',
      threshold: 0.6,
      labels: { brief: ['singkat'], detailed: ['detail', 'rinci'] },
    });
    expect(examplesOf(catalog)).toEqual([
      { label: 'brief', text: 'singkat' },
      { label: 'detailed', text: 'detail' },
      { label: 'detailed', text: 'rinci' },
    ]);
  });

  it('catalogIssues: katalog tak dikenal, label tak dikenal, contoh ganda lintas label', () => {
    expect(
      catalogIssues(CatalogSchema.parse({ name: 'nope', threshold: 0.5, labels: { x: ['y'] } })),
    ).toEqual(['katalog "nope" tidak dikenal kode']);
    expect(
      catalogIssues(
        CatalogSchema.parse({
          name: 'depth',
          threshold: 0.5,
          labels: { brief: ['singkat', 'Semua'], comprehensive: ['semua'], bogus: ['x'] },
        }),
      ),
    ).toEqual([
      'label "bogus" tidak dikenal di katalog "depth"',
      'contoh "semua" ada di label "brief" dan "comprehensive"',
    ]);
    expect(
      catalogIssues(
        CatalogSchema.parse({ name: 'depth', threshold: 0.5, labels: { brief: ['singkat'] } }),
      ),
    ).toEqual([]);
  });
});
