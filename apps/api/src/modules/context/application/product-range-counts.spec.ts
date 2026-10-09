/**
 * "Produk Pralon HDPE ada berapa varian?" (audit 2026-10-09): jumlah dari hitungan repository
 * (produk berbeda), dan selisihnya dengan jumlah SKU disebut — bukan disembunyikan.
 */
import { describe, expect, it } from 'vitest';
import { familyRange, rangeOverview, type RangeCatalog } from './product-range.js';

const NAMES = [
  'Pipa HDPE PE 100 PN-8 160 mm x 6 Meter',
  'Pipa HDPE PE 100 PN-10 160 mm x 6 Meter',
  'Pipa HDPE Gas SDR-13.6 50 mm x 100 Meter Kuning',
];
const catalog: RangeCatalog = {
  activeVersion: async () => ({ id: 'V', kind: 'pralon' }) as never,
  familyCounts: async () => [
    { family: 'HDPE', count: 3, skuCount: 4 },
    { family: 'MDPE', count: 2, skuCount: 2 },
  ],
  productNamesInFamily: async (family) => (family === 'HDPE' ? NAMES : []),
};

describe('jumlah produk vs SKU', () => {
  it('satu keluarga: produk berbeda, dengan jumlah SKU bila berbeda', async () => {
    const out = await familyRange(catalog, ['hdpe'], 'id');
    expect(out!.text).toContain(
      'keluarga HDPE ada 3 produk (4 SKU; SKU yang namanya sama dihitung sekali)',
    );
  });

  it('ikhtisar: total dari repository, bukan dari teks hasil pencarian', async () => {
    const out = await rangeOverview(catalog, 'id');
    expect(out.text).toContain(
      'Katalog Pralon yang aktif memuat 5 produk dalam 2 keluarga (6 SKU; SKU yang namanya sama dihitung sekali)',
    );
  });
});
