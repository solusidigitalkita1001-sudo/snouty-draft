/**
 * OQ-103 (keputusan pemilik 2026-11-27): bila sumbernya di atas tujuan, jawabannya menyebut
 * ukuran yang membuat pompanya tidak perlu — di samping ukuran terpilih dan pompanya. Ukurannya
 * TIDAK diubah sendiri: pipa induk sepanjang kilometer adalah material yang dibeli orang.
 *
 * Kasus produksi 2026-11-27: jaringan desa 300 rumah, 4,37 l/s, 1.500 m, mata air 40 m di atas
 * permukiman. Pilihan 2" kehilangan 93 m dan menyisakan pompa 63 m; ada ukuran yang muat di
 * dalam 40 m itu.
 */
import { describe, expect, it } from 'vitest';
import { ENG_205 } from './group-f-pressurized.js';

const VILLAGE = {
  designFlowLs: 4.37,
  lengthM: 1500,
  residualPressureBar: 1,
  hazenWilliamsC: 150,
  velocityMinMs: 0.6,
  velocityMaxMs: 2,
  gradientMaxMPer100m: 10,
  minorLossFraction: 0.1,
  sizeTable: 'pvc_inch' as const,
};

describe('ENG-205: ukuran yang membuat pompa tidak perlu', () => {
  it('sumber di atas: ukuran yang muat disebut, ukuran terpilih tidak berubah', () => {
    const out = ENG_205.compute({ ...VILLAGE, staticHeadM: -40 });
    expect(out.recommended).toBe('2"');
    expect(out.gravityFitSize).not.toBeNull();
    const fit = out.candidates.find((c) => c.size === out.gravityFitSize)!;
    // Yang disebut memang muat: kehilangan + kerugian minor ≤ 40 m − 1 bar sisa.
    expect(fit.frictionLossM * 1.1).toBeLessThanOrEqual(40 - 10.2);
    // dan ia lebih besar dari yang terpilih, bukan menggantikannya.
    expect(out.candidates.indexOf(fit)).toBeGreaterThan(
      out.candidates.findIndex((c) => c.size === out.recommended),
    );
  });

  it('kalimatnya menyebut dua-duanya, dalam dua bahasa', () => {
    const input = { ...VILLAGE, staticHeadM: -40 };
    const out = ENG_205.compute(input);
    const id = ENG_205.explain!(input, out, 'id');
    expect(id).toContain(out.recommended);
    expect(id).toContain(out.gravityFitSize!);
    expect(id).toContain('tanpa pompa');
    const en = ENG_205.explain!(input, out, 'en');
    expect(en).toContain('without a pump');
  });

  it('air yang dinaikkan tidak menyebut apa pun soal gravitasi', () => {
    const input = { ...VILLAGE, staticHeadM: 40 };
    const out = ENG_205.compute(input);
    expect(out.gravityFitSize).toBeNull();
    expect(ENG_205.explain!(input, out, 'id')).not.toContain('tanpa pompa');
  });

  it('beda tinggi yang tidak cukup untuk ukuran mana pun tetap null', () => {
    // Sumber hanya 0,5 m di atas: tekanan sisa 1 bar saja sudah melebihinya.
    const out = ENG_205.compute({ ...VILLAGE, staticHeadM: -0.5 });
    expect(out.gravityFitSize).toBeNull();
  });
});
