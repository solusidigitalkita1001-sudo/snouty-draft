/**
 * P11-02a — skor lead deterministik dan bisa dijelaskan (§6).
 */
import { describe, expect, it } from 'vitest';
import type { EmailAnalysis } from './email-analysis.schema.js';
import { EmailAnalysisSchema } from './email-analysis.schema.js';
import { scoreLead } from './lead-score.js';

const BASE: EmailAnalysis = {
  intent: 'pertanyaan_produk',
  leadType: 'tidak_diketahui',
  company: null,
  projectType: null,
  projectLocation: null,
  projectScale: null,
  unitCount: null,
  buildingInfo: null,
  requestedProducts: [],
  quotationIntent: false,
  missingTechnicalInfo: [],
  urgency: null,
};

describe('skor lead', () => {
  it('email tanpa sinyal apa pun: dingin', () => {
    const result = scoreLead({ analysis: BASE, catalogMatches: 0 });
    expect(result.score).toBe(0);
    expect(result.temperature).toBe('dingin');
  });

  it('permintaan penawaran saja sudah hangat', () => {
    const result = scoreLead({ analysis: { ...BASE, quotationIntent: true }, catalogMatches: 0 });
    expect(result.score).toBe(40);
    expect(result.temperature).toBe('hangat');
  });

  it('kontraktor dengan proyek besar dan penawaran: panas', () => {
    const result = scoreLead({
      analysis: {
        ...BASE,
        quotationIntent: true,
        projectScale: 'besar',
        leadType: 'kontraktor',
      },
      catalogMatches: 0,
    });
    expect(result.score).toBe(75);
    expect(result.temperature).toBe('panas');
  });

  it('memakai contoh lengkap dengan seluruh sinyal', () => {
    const result = scoreLead({
      analysis: {
        ...BASE,
        quotationIntent: true,
        projectScale: 'besar',
        leadType: 'developer',
        unitCount: 120,
        urgency: 'tinggi',
      },
      catalogMatches: 2,
    });
    expect(result.score).toBe(100);
  });

  it('proyek sedang bernilai separuh proyek besar', () => {
    const besar = scoreLead({ analysis: { ...BASE, projectScale: 'besar' }, catalogMatches: 0 });
    const sedang = scoreLead({ analysis: { ...BASE, projectScale: 'sedang' }, catalogMatches: 0 });
    expect(sedang.score * 2).toBe(besar.score);
  });

  it('unit di bawah 50 tidak menambah skor', () => {
    const result = scoreLead({ analysis: { ...BASE, unitCount: 49 }, catalogMatches: 0 });
    expect(result.score).toBe(0);
  });

  it('pemilik bangunan dan konsultan tidak mendapat bonus tipe lead', () => {
    for (const leadType of ['pemilik_bangunan', 'konsultan'] as const) {
      expect(scoreLead({ analysis: { ...BASE, leadType }, catalogMatches: 0 }).score).toBe(0);
    }
  });

  it('skornya bisa dijelaskan — setiap poin punya alasan', () => {
    // Tim penjualan harus bisa bertanya "kenapa 65?" dan mendapat jawaban, bukan angka
    // ajaib dari model.
    const result = scoreLead({
      analysis: { ...BASE, quotationIntent: true, leadType: 'distributor', urgency: 'tinggi' },
      catalogMatches: 0,
    });
    expect(result.breakdown.reduce((sum, item) => sum + item.points, 0)).toBe(result.score);
    expect(result.breakdown.map((item) => item.reason)).toEqual([
      'Meminta penawaran',
      'Tipe lead distributor',
      'Urgensi tinggi',
    ]);
  });

  it('ambang suhu: 60 panas, 30 hangat, 29 dingin', () => {
    const at = (score: number) =>
      scoreLead({
        analysis: {
          ...BASE,
          quotationIntent: score >= 40,
          projectScale: score === 60 ? 'besar' : score === 30 ? null : null,
          leadType: score === 60 ? 'kontraktor' : 'tidak_diketahui',
        },
        catalogMatches: 0,
      });
    expect(at(40).temperature).toBe('hangat');
    expect(at(60).temperature).toBe('panas');
    expect(at(0).temperature).toBe('dingin');
  });
});

describe('EmailAnalysisSchema', () => {
  it('menerima analisis lengkap', () => {
    expect(() => EmailAnalysisSchema.parse(BASE)).not.toThrow();
  });

  it('menolak intent di luar daftar', () => {
    expect(() => EmailAnalysisSchema.parse({ ...BASE, intent: 'spam' })).toThrow();
  });

  it('menolak properti tak dikenal (.strict — keluaran model tak tepercaya)', () => {
    expect(() => EmailAnalysisSchema.parse({ ...BASE, hargaFinal: 5_000_000 })).toThrow();
  });

  it('menolak unitCount negatif dan tak masuk akal', () => {
    expect(() => EmailAnalysisSchema.parse({ ...BASE, unitCount: -1 })).toThrow();
    expect(() => EmailAnalysisSchema.parse({ ...BASE, unitCount: 9_999_999 })).toThrow();
  });

  it('menerima null untuk field yang memang bisa tidak ada di satu email', () => {
    const parsed = EmailAnalysisSchema.parse({ ...BASE, company: null, urgency: null });
    expect(parsed.company).toBeNull();
  });

  it('membatasi panjang daftar produk agar keluaran kacau tidak lolos', () => {
    const many = Array.from({ length: 51 }, (_, i) => `produk-${i}`);
    expect(() => EmailAnalysisSchema.parse({ ...BASE, requestedProducts: many })).toThrow();
  });
});
