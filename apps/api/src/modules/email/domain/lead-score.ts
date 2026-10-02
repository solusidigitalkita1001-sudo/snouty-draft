/**
 * Skor lead. docs/EMAIL_INTELLIGENCE.md §6. **Fungsi murni, tanpa LLM.**
 *
 * Deterministik dari hasil ekstraksi — bukan penilaian model. Dua akibatnya yang
 * menentukan: skornya bisa **diaudit** (tim penjualan bisa bertanya "kenapa 65?" dan
 * mendapat jawaban), dan bisa **disetel** tanpa menyentuh prompt atau menjalankan
 * evaluasi ulang.
 *
 * Bobotnya tebakan awal dan perlu disetel setelah melihat data nyata. Yang penting bukan
 * ketepatannya hari ini, melainkan bahwa ia terlihat dan bisa diubah.
 */

import type { EmailAnalysis } from './email-analysis.schema.js';

export type LeadTemperature = 'panas' | 'hangat' | 'dingin';

export interface LeadScore {
  readonly score: number;
  readonly temperature: LeadTemperature;
  /** Rincian kontribusi — inilah yang membuat skornya bisa dijelaskan, bukan angka ajaib. */
  readonly breakdown: readonly { readonly reason: string; readonly points: number }[];
}

const COMMERCIAL_LEAD_TYPES = new Set(['kontraktor', 'developer', 'distributor']);

export interface ScoreInput {
  readonly analysis: EmailAnalysis;
  /** Jumlah `requestedProducts` yang benar-benar cocok dengan katalog. */
  readonly catalogMatches: number;
}

export function scoreLead(input: ScoreInput): LeadScore {
  const { analysis } = input;
  const breakdown: { reason: string; points: number }[] = [];

  if (analysis.quotationIntent) {
    // Pemisah terpenting: "berapa harga 500 batang" versus "apa bedanya AW dan D".
    // Keduanya email; hanya satu yang peluang.
    breakdown.push({ reason: 'Meminta penawaran', points: 40 });
  }

  if (analysis.projectScale === 'besar') breakdown.push({ reason: 'Proyek besar', points: 20 });
  else if (analysis.projectScale === 'sedang')
    breakdown.push({ reason: 'Proyek sedang', points: 10 });

  if (COMMERCIAL_LEAD_TYPES.has(analysis.leadType)) {
    breakdown.push({ reason: `Tipe lead ${analysis.leadType}`, points: 15 });
  }

  if (analysis.unitCount !== null && analysis.unitCount >= 50) {
    breakdown.push({ reason: `${analysis.unitCount} unit`, points: 10 });
  }

  if (analysis.urgency === 'tinggi') breakdown.push({ reason: 'Urgensi tinggi', points: 10 });

  if (input.catalogMatches > 0) {
    breakdown.push({ reason: 'Produk cocok katalog', points: 5 });
  }

  const score = breakdown.reduce((sum, item) => sum + item.points, 0);
  return { score, temperature: temperatureOf(score), breakdown };
}

function temperatureOf(score: number): LeadTemperature {
  if (score >= 60) return 'panas';
  if (score >= 30) return 'hangat';
  return 'dingin';
}
