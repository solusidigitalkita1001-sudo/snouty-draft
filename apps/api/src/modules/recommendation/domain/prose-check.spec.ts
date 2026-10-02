/**
 * P7-07a — invarian REC-1: prosa tidak boleh memuat angka di luar hasil hitungan.
 */
import { describe, expect, it } from 'vitest';
import { checkProse, extractNumbers, extractSizeLabels } from './prose-check.js';

const ALLOWED = {
  allowedNumbers: [8, 11, 4, 6, 5, 9, 3.5],
  allowedSizes: ['1"', '3/4"', '1/2"'],
};

describe('ekstraksi angka', () => {
  it('menemukan bilangan bulat dan desimal (koma maupun titik)', () => {
    expect(extractNumbers('8 titik air, tinggi 3,5 meter, 2.5 bar')).toEqual([8, 3.5, 2.5]);
  });

  it('tidak memecah pecahan ukuran pipa menjadi dua angka', () => {
    // "3/4 inci" adalah SATU nilai; memecahnya akan memunculkan 3 dan 4 sebagai
    // angka asing dan membuat pemeriksa menolak prosa yang sebenarnya benar.
    expect(extractNumbers('pipa 3/4 inci')).toEqual([]);
  });

  it('mengenali label ukuran termasuk karakter pecahan', () => {
    expect(extractSizeLabels('ukuran 3/4 dan 1¼')).toEqual(['3/4', '1¼']);
  });
});

describe('checkProse (REC-1)', () => {
  it('meloloskan prosa yang hanya memakai angka terhitung', () => {
    const result = checkProse({
      headline: 'Sistem distribusi gravitasi dari toren atap',
      body: 'Total 8 titik air dengan 11 unit beban, sehingga jalur utama memakai 1" dan cabang 3/4".',
      ...ALLOWED,
    });
    expect(result.ok).toBe(true);
  });

  it('menolak angka yang tidak pernah dihitung', () => {
    const result = checkProse({
      headline: 'Rekomendasi sistem',
      body: 'Anda memerlukan sekitar 12 batang pipa.',
      ...ALLOWED,
    });
    expect(result.ok).toBe(false);
    expect(result.foreignNumbers).toContain(12);
  });

  it('menolak ukuran yang tidak pernah dipilih', () => {
    const result = checkProse({
      headline: 'Rekomendasi sistem',
      body: 'Gunakan pipa 2 1/2 inci untuk jalur utama.',
      ...ALLOWED,
    });
    expect(result.ok).toBe(false);
    expect(result.foreignSizes.length).toBeGreaterThan(0);
  });

  it('mengizinkan 0, 1, dan 2 sebagai angka prosa biasa', () => {
    const result = checkProse({
      headline: 'Satu jalur utama',
      body: 'Ada 2 cabang, masing-masing melayani 4 titik air.',
      ...ALLOWED,
    });
    expect(result.ok).toBe(true);
  });

  it('membandingkan ukuran tanpa terganggu tanda kutip inci', () => {
    const result = checkProse({
      headline: 'Jalur utama 3/4"',
      body: 'Cabang memakai 3/4 inci.',
      ...ALLOWED,
    });
    expect(result.ok).toBe(true);
  });

  it('melaporkan setiap angka asing hanya sekali', () => {
    const result = checkProse({
      headline: 'Perlu 99 batang',
      body: 'Ya, 99 batang pipa dan 99 fitting.',
      ...ALLOWED,
    });
    expect(result.foreignNumbers).toEqual([99]);
  });

  it('prosa tanpa angka selalu lolos', () => {
    const result = checkProse({
      headline: 'Sistem distribusi gravitasi',
      body: 'Jalur utama turun dari toren ke setiap lantai.',
      ...ALLOWED,
    });
    expect(result.ok).toBe(true);
  });
});
