/**
 * Visibilitas katalog: tiga fungsi murni, tiga invarian. Yang paling penting: katalog
 * contoh diizinkan **hanya** di development — bukan juga di `test`, supaya tidak ada tes
 * yang lulus karena data karangan lolos pagar.
 */
import { describe, expect, it } from 'vitest';
import { isAnswerable, isAuthoritative, sampleCatalogAllowed } from './catalog-visibility.js';

describe('catalog visibility', () => {
  it('hanya versi `pralon` yang otoritatif', () => {
    expect(isAuthoritative({ kind: 'pralon' })).toBe(true);
    expect(isAuthoritative({ kind: 'sample' })).toBe(false);
  });

  it('katalog contoh hanya di development', () => {
    expect(sampleCatalogAllowed('development')).toBe(true);
    expect(sampleCatalogAllowed('test')).toBe(false);
    expect(sampleCatalogAllowed('production')).toBe(false);
    expect(sampleCatalogAllowed('')).toBe(false);
  });

  it('produk discontinued tidak dijawab "tersedia"', () => {
    expect(isAnswerable({ status: 'active' })).toBe(true);
    expect(isAnswerable({ status: 'discontinued' })).toBe(false);
  });
});
