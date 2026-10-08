/**
 * Data contoh yang SUNGGUHAN (`data/understanding/`) harus memuat tanpa cacat: setiap katalog
 * dikenal kode, setiap label sah, tidak ada contoh ganda lintas label, dan kosakata valid.
 * Cacat di sini menggagalkan boot API — lebih baik ketahuan di tes daripada di deploy.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG_LABELS } from '../domain/labels.js';
import { HashedNgramEncoder } from './hashed-ngram.encoder.js';
import { findDataDir, loadUnderstandingData } from './catalog-files.js';

describe('data/understanding', () => {
  it('ditemukan dari direktori kerja, dan setiap katalog yang dikenal kode punya berkasnya', () => {
    const dir = findDataDir();
    expect(dir).not.toBeNull();
    const data = loadUnderstandingData(dir!);
    const names = data.catalogs.map((c) => c.name).sort();
    expect(names).toEqual(Object.keys(CATALOG_LABELS).sort());
    // Setiap label yang dikenal kode punya contoh — label tanpa contoh tidak pernah dikenali.
    for (const catalog of data.catalogs) {
      const known = CATALOG_LABELS[catalog.name]!;
      for (const label of known) {
        expect(catalog.labels[label]?.length ?? 0, `${catalog.name}/${label}`).toBeGreaterThan(0);
      }
    }
  });

  it('kosakata memuat keluarga produk yang dipakai pengetahuan pipa dan merek sendiri', () => {
    const data = loadUnderstandingData(findDataDir()!);
    for (const family of ['pvc', 'pvc aw', 'pvc d', 'hdpe', 'ppr', 'galvanis']) {
      expect(Object.keys(data.vocabulary.productFamilies)).toContain(family);
    }
    expect(data.vocabulary.ownBrand).toContain('pralon');
  });

  it('direktori tanpa vocabulary.json tidak ditemukan; mencari ke atas berhenti di akar', () => {
    expect(findDataDir('/')).toBeNull();
  });
});

describe('HashedNgramEncoder — penyandi cadangan tanpa model', () => {
  it('deterministik, ternormalisasi, dan hanya kalimat yang mirip ejaannya yang mirip', async () => {
    const encoder = new HashedNgramEncoder();
    const [a, b, c, d] = await encoder.encode([
      'makasih ya',
      'makasih ya',
      'makasih',
      'rumah 2 lantai',
    ]);
    expect(Array.from(a!)).toEqual(Array.from(b!));
    const length = Math.sqrt(Array.from(a!).reduce((s, x) => s + x * x, 0));
    expect(length).toBeCloseTo(1, 5);
    const dot = (x: Float32Array, y: Float32Array) =>
      Array.from(x).reduce((s, v, i) => s + v * y[i]!, 0);
    expect(dot(a!, c!)).toBeGreaterThan(0.5);
    expect(dot(a!, d!)).toBeLessThan(0.3);
  });
});
