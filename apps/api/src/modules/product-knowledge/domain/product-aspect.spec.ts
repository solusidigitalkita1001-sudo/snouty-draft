/**
 * P2-02a — **setiap aspek punya jalur data; tidak ada aspek yang jatuh ke LLM.**
 *
 * Tes paling penting di berkas ini adalah yang memeriksa kelengkapan peta, bukan
 * yang memeriksa satu entri. Aspek yang lupa dipetakan tidak akan menimbulkan galat
 * apa pun — ia hanya akan dijawab model dari ingatannya, dan ingatan model bukan
 * katalog Pralon.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG_SPEC_KEY_LIST } from '../../product-catalog/domain/catalog-spec-keys.js';
import {
  ASPECT_LABEL,
  ASPECT_SOURCE,
  isProductAspect,
  PRODUCT_ASPECTS,
  PRODUCT_ASPECT_LIST,
  requiresSize,
} from './product-aspect.js';

describe('kelengkapan peta aspek', () => {
  it('memberi setiap aspek satu sumber data', () => {
    for (const aspect of PRODUCT_ASPECT_LIST) {
      expect(ASPECT_SOURCE[aspect], `aspek ${aspect} tanpa sumber data`).toBeDefined();
    }
  });

  it('memberi setiap aspek label untuk dirangkai menjadi kalimat', () => {
    for (const aspect of PRODUCT_ASPECT_LIST) {
      expect(ASPECT_LABEL[aspect], `aspek ${aspect} tanpa label`).toBeTruthy();
    }
  });

  it('tidak memuat sumber data untuk aspek yang tidak ada', () => {
    // Peta yang lebih besar dari kosakatanya berarti ada aspek yang sudah dihapus
    // tetapi jalurnya masih hidup.
    expect(Object.keys(ASPECT_SOURCE).sort()).toEqual([...PRODUCT_ASPECT_LIST].sort());
    expect(Object.keys(ASPECT_LABEL).sort()).toEqual([...PRODUCT_ASPECT_LIST].sort());
  });

  it('memakai hanya sumber data yang benar-benar ada di katalog', () => {
    const tables = new Set(['product_sizes', 'product_compatibility', 'product_specs']);

    for (const aspect of PRODUCT_ASPECT_LIST) {
      expect(tables.has(ASPECT_SOURCE[aspect])).toBe(true);
    }
  });
});

describe('aspek spesifikasi memakai kosakata yang sama dengan database', () => {
  it('menamai keenam aspek spesifikasi persis seperti `spec_key`-nya', () => {
    // Dua kosakata untuk satu hal akan menuntut tabel pemetaan, dan tabel pemetaan
    // adalah tempat penyimpangan bersembunyi.
    for (const key of CATALOG_SPEC_KEY_LIST) {
      expect(isProductAspect(key), `spec_key ${key} bukan aspek`).toBe(true);
    }
  });

  it('mencakup seluruh enam field spesifikasi, bukan sebagian', () => {
    const specAspects = PRODUCT_ASPECT_LIST.filter(
      (aspect) => ASPECT_SOURCE[aspect] === 'product_specs',
    );

    expect([...specAspects].sort()).toEqual([...CATALOG_SPEC_KEY_LIST].sort());
  });
});

describe('isProductAspect', () => {
  it('menolak nama aspek yang dikarang', () => {
    // Intent router memetakan pertanyaan bebas ke kosakata ini. Nama yang tidak
    // dikenal berarti pertanyaan yang belum didukung — bukan aspek terdekat.
    expect(isProductAspect('harga')).toBe(false);
    expect(isProductAspect('warna')).toBe(false);
    expect(isProductAspect('')).toBe(false);
  });

  it('menerima seluruh nama aspek yang sah', () => {
    for (const aspect of PRODUCT_ASPECT_LIST) {
      expect(isProductAspect(aspect)).toBe(true);
    }
  });
});

describe('requiresSize', () => {
  it('menandai hanya pertanyaan ketersediaan ukuran', () => {
    expect(requiresSize(PRODUCT_ASPECTS.sizeAvailability)).toBe(true);
    expect(requiresSize(PRODUCT_ASPECTS.sizes)).toBe(false);
    expect(requiresSize(PRODUCT_ASPECTS.pressureClass)).toBe(false);
  });
});
