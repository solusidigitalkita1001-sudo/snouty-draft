/**
 * Teks jawaban produk dua bahasa: Indonesia tidak berubah, Inggris berstruktur sama
 * dan membawa angka serta sumber yang sama.
 */
import type { Product } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import {
  ASPECT_LABEL,
  ASPECT_LABEL_EN,
  PRODUCT_ANSWER_COPY,
  PRODUCT_ANSWER_COPY_EN,
  answerText,
  aspectLabel,
  overviewText,
  productAnswerCopy,
} from './product-answer-text.js';

const AW: Product = {
  id: 'A'.repeat(26),
  sku: 'AW',
  name: 'Pipa PVC AW',
  family: 'PVC AW',
  category: 'PIPA AIR BERSIH · SNI',
  description: 'Pipa untuk air bersih bertekanan.',
  status: 'active',
  sizes: ['1/2"', '3/4"'],
  material: { provenance: 'VERIFIED', value: 'uPVC' },
  standard: { provenance: 'VERIFIED', value: 'SNI 06-0084' },
  pressureClass: { provenance: 'UNAVAILABLE', value: null },
  rodLength: { provenance: 'VERIFIED', value: '4 m' },
  jointType: { provenance: 'VERIFIED', value: 'Solvent cement' },
  application: { provenance: 'VERIFIED', value: 'Air bersih' },
  sourceDocument: 'Katalog 2026',
  sourcePage: 14,
  catalogVersionId: 'V'.repeat(26),
  imageUrl: null,
};

const AVAILABLE = {
  kind: 'availability',
  aspect: 'size_availability',
  available: true,
  sizeLabel: '3/4"',
  sourceDocument: 'Katalog 2026',
  sourcePage: 14,
} as never;

describe('product answer text locale', () => {
  it('Indonesia tetap persis seperti sebelumnya', () => {
    expect(overviewText(AW)).toBe(
      'Pipa PVC AW: Pipa untuk air bersih bertekanan. Material uPVC. Aplikasi: Air bersih. Standar SNI 06-0084.',
    );
    expect(answerText(AW, AVAILABLE)).toBe(
      'Pipa PVC AW tersedia dalam ukuran 3/4". Sumber: Katalog 2026 hal. 14.',
    );
    expect(answerText(AW, AVAILABLE, 'id')).toBe(answerText(AW, AVAILABLE));
  });

  it('Inggris: kalimat Inggris, angka dan sumber sama', () => {
    expect(overviewText(AW, 'en')).toBe(
      'Pipa PVC AW: Pipa untuk air bersih bertekanan. Material: uPVC. Application: Air bersih. Standard: SNI 06-0084.',
    );
    expect(answerText(AW, AVAILABLE, 'en')).toBe(
      'Pipa PVC AW is available in size 3/4". Source: Katalog 2026 p. 14.',
    );
    const insufficient = { kind: 'insufficientData', aspect: 'pressure_class' } as never;
    expect(answerText(AW, insufficient, 'en')).toContain(
      'Working pressure for Pipa PVC AW is not listed',
    );
  });

  it('salinan Inggris punya kunci yang sama dan label aspek lengkap', () => {
    expect(Object.keys(PRODUCT_ANSWER_COPY_EN).sort()).toEqual(
      Object.keys(PRODUCT_ANSWER_COPY).sort(),
    );
    expect(Object.keys(ASPECT_LABEL_EN).sort()).toEqual(Object.keys(ASPECT_LABEL).sort());
    expect(productAnswerCopy('en')).toBe(PRODUCT_ANSWER_COPY_EN);
    expect(productAnswerCopy('id')).toBe(PRODUCT_ANSWER_COPY);
    expect(aspectLabel('standard', 'en')).toBe('Standard');
    expect(aspectLabel('standard')).toBe('Standar');
  });
});
