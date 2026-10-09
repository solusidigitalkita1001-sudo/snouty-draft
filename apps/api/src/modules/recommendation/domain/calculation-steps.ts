/**
 * Langkah hitung per baris sistem untuk panel "detail teknis" (laporan pemilik 2026-10-09: "gw
 * gak paham rumus itu"). Setiap baris sistem sudah menunjuk trace-nya (`traceIds`); di sini trace
 * itu diubah menjadi langkah bernomor — judul langkah dari engine + penjelasan aturan — tanpa
 * kode aturan, dengan angka berformat Indonesia. **Fungsi murni.**
 */
import { ruleStepTitle } from '@snouty/engineering';
import type { CalculationStep, Locale, Recommendation } from '@snouty/shared-types';
import type { IdentifiedTrace } from './solution-view.js';

/**
 * Desimal bertitik dari penjelasan aturan ("0.65 m", "14.073 kW") → koma untuk Bahasa Indonesia.
 * Penjelasan aturan tidak memakai pemisah ribuan, jadi titik di antara dua angka selalu desimal.
 */
export function readableNumbers(text: string, locale: Locale): string {
  return locale === 'en' ? text : text.replace(/(\d)\.(\d)/g, '$1,$2');
}

export function stepsFor(
  traceIds: readonly string[],
  traces: readonly IdentifiedTrace[],
  locale: Locale,
): readonly CalculationStep[] {
  const seen = new Set<string>();
  const steps: CalculationStep[] = [];
  for (const trace of traces) {
    if (!traceIds.includes(trace.id) || trace.explanation.trim() === '') continue;
    // Aturan yang sama dua kali di satu baris (mis. kelompok hidraulik untuk dua jalur) cukup sekali.
    const key = `${trace.ruleId}|${trace.explanation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push({
      title: ruleStepTitle(trace.ruleId, locale),
      text: readableNumbers(trace.explanation, locale),
    });
  }
  return steps;
}

/** Rekomendasi siap simpan: setiap baris sistem membawa langkah hitungnya; angka berformat lokal. */
export function withCalculationSteps(
  recommendation: Recommendation,
  traces: readonly IdentifiedTrace[],
  locale: Locale,
): Recommendation {
  return {
    ...recommendation,
    systemLines: recommendation.systemLines.map((line) => ({
      ...line,
      reason: readableNumbers(line.reason, locale),
      steps: stepsFor(line.traceIds, traces, locale),
    })),
    bom: recommendation.bom.map((item) => ({
      ...item,
      basis: readableNumbers(item.basis, locale),
    })),
  };
}
