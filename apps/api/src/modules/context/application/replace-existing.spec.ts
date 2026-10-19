/**
 * P22-03: "ganti pipa lama ke Pralon" — field kebutuhan yang hanya dipercaya bila penggantiannya
 * disebut, berlabel bahasa pengguna, dan mengubah kata-kata solusi (bukan angkanya).
 */
import { describe, expect, it } from 'vitest';
import { templateProse } from '../../recommendation/application/recommendation-assembler.js';
import { requirementValueLabel } from '../domain/requirement-labels.js';
import { extractionToUpdates } from './extraction-to-updates.js';
import {
  answerToUpdate,
  houseRefinementQuestions,
  planClarification,
  renovationRefinementFields,
} from '../domain/clarification.js';
import { withCompleteness } from '../domain/completeness.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';

const stats = {
  outletCount: 3,
  mainSize: '3/4"',
  branchCount: 1,
  fixtureConnectionSize: '1/2"',
  productCount: 4,
};

describe('water.replaceExisting', () => {
  it('dipercaya bila pesan menyebut penggantian; tanpa penanda itu keluaran model dibuang', () => {
    const extraction = { water: { replaceExisting: true } };
    const grounded = extractionToUpdates(extraction, 'mau ganti pipa rumah subsidi ke pralon');
    expect(grounded).toContainEqual(
      expect.objectContaining({ path: 'water.replaceExisting', value: true }),
    );
    const ungrounded = extractionToUpdates(extraction, 'rumah 1 lantai 1 kamar mandi');
    expect(ungrounded.some((u) => u.path === 'water.replaceExisting')).toBe(false);
  });

  it('label nilai: Ganti pipa lama / Instalasi baru, dua bahasa', () => {
    expect(requirementValueLabel('water.replaceExisting', true)).toBe('Ganti pipa lama');
    expect(requirementValueLabel('water.replaceExisting', false)).toBe('Instalasi baru');
    expect(requirementValueLabel('water.replaceExisting', true, 'en')).toBe(
      'Replace the existing pipes',
    );
  });

  it('templat prosa: judul dan kalimat pembuka menyebut penggantian, angka tidak berubah', () => {
    const fresh = templateProse(stats, 'id');
    const replaced = templateProse(stats, 'id', true);
    expect(replaced.headline).toBe('Penggantian pipa ke Pralon untuk 3 titik air');
    expect(replaced.body).toContain('daftar materialnya sama dengan instalasi baru');
    expect(replaced.body).toContain(fresh.body);
    expect(templateProse(stats, 'en', true).headline).toContain('Replacing the pipes with Pralon');
  });
});

describe('renovasi rumah (P23-03): jenis pekerjaan dan data pipa lama', () => {
  it('field dipercaya hanya dengan penanda di pesan; ukuran pipa lama dinormalkan ke label kanonik', () => {
    const extraction = {
      water: {
        workType: 'extend' as const,
        existingMainSize: '3/4 inch',
        existingPipeMaterial: 'galvanized' as const,
        existingOutlets: 4,
      },
    };
    const grounded = extractionToUpdates(
      extraction,
      'mau tambah 1 kamar mandi, pipa lama 3/4 inch galvanis, sudah ada 4 titik air',
    );
    expect(grounded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'water.workType', value: 'extend' }),
        expect.objectContaining({ path: 'water.existingMainSize', value: '3/4"' }),
        expect.objectContaining({ path: 'water.existingPipeMaterial', value: 'galvanized' }),
        expect.objectContaining({ path: 'water.existingOutlets', value: 4 }),
      ]),
    );
    const ungrounded = extractionToUpdates(extraction, 'rumah 1 lantai 1 kamar mandi');
    expect(ungrounded.some((u) => u.path.startsWith('water.existing'))).toBe(false);
    expect(ungrounded.some((u) => u.path === 'water.workType')).toBe(false);
    // Ukuran yang tidak terbaca dibuang, bukan disimpan sebagai teks bebas.
    expect(
      extractionToUpdates({ water: { existingMainSize: 'besar' } }, 'pipa lama ukuran besar').some(
        (u) => u.path === 'water.existingMainSize',
      ),
    ).toBe(false);
  });

  it('label nilai jenis pekerjaan dan bahan pipa lama, dua bahasa', () => {
    expect(requirementValueLabel('water.workType', 'extend')).toBe('Perluasan');
    expect(requirementValueLabel('water.workType', 'renovation')).toBe(
      'Renovasi (jenisnya belum disebut)',
    );
    expect(requirementValueLabel('water.existingPipeMaterial', 'galvanized', 'en')).toBe(
      'Galvanized / steel',
    );
    expect(requirementValueLabel('water.replacementLengthM', 12)).toBe('12 m');
    expect(requirementValueLabel('water.existingOutlets', 4)).toBe('4 titik');
  });

  it('kartu: renovasi tanpa jenis menahan dan ditanya lebih dulu; perluasan menanyakan pipa lama di kartu penyempurna', () => {
    const now = '2026-01-01T00:00:00.000Z';
    const tracked = <T>(value: T) => ({
      value,
      provenance: 'VERIFIED' as const,
      source: 'user_stated' as const,
      updatedAt: now,
    });
    const s0 = emptyRequirementState(now);
    const unclear = withCompleteness({
      ...s0,
      water: { ...s0.water, workType: tracked('renovation' as const) },
    });
    expect(unclear.missingInformation).toContain('water.workType');
    const plan = planClarification(unclear.missingInformation);
    expect(plan?.questions[0]).toMatchObject({ id: 'water.workType' });
    expect(
      answerToUpdate({ id: 'water.workType', option: 'Tambah titik air (perluasan)' }, () => null),
    ).toMatchObject({
      value: 'extend',
    });
    expect(
      answerToUpdate({ id: 'water.existingPipeMaterial', option: 'Galvanis / besi' }, () => null),
    ).toMatchObject({
      value: 'galvanized',
    });
    expect(
      answerToUpdate({ id: 'water.replacementLengthM', option: 'value=12' }, () => null),
    ).toMatchObject({
      value: 12,
    });
    const extend = houseRefinementQuestions(
      () => false,
      'id',
      'residential',
      'rooftop_tank',
      'extend',
    ).map((q) => q.id);
    expect(extend.slice(0, 3)).toEqual([
      'water.existingMainSize',
      'water.existingOutlets',
      'water.existingPipeMaterial',
    ]);
    expect(
      houseRefinementQuestions(() => false, 'id', 'residential', 'rooftop_tank', null).map(
        (q) => q.id,
      ),
    ).not.toContain('water.existingMainSize');
    expect(renovationRefinementFields('replace_partial')).toEqual([
      'water.replacementLengthM',
      'water.existingPipeMaterial',
    ]);
  });
});
