/**
 * P22-03: "ganti pipa lama ke Pralon" — field kebutuhan yang hanya dipercaya bila penggantiannya
 * disebut, berlabel bahasa pengguna, dan mengubah kata-kata solusi (bukan angkanya).
 */
import { describe, expect, it } from 'vitest';
import { templateProse } from '../../recommendation/application/recommendation-assembler.js';
import { requirementValueLabel } from '../domain/requirement-labels.js';
import { extractionToUpdates } from './extraction-to-updates.js';

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
