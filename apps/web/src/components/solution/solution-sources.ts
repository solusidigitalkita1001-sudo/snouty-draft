/**
 * Acuan yang dipakai sebuah hitungan, dikumpulkan dari langkah hitungan dan baris asumsinya.
 *
 * Satu daftar di bawah rekomendasi menjawab pertanyaan yang tidak terjawab oleh sumber per
 * langkah: pedoman apa saja yang dipakai seluruh hitungan ini (laporan pemilik 2026-11-03).
 * Sebuah langkah boleh menyebut lebih dari satu dokumen, dipisah titik koma.
 */
import type { Recommendation } from '@snouty/shared-types';

export function citedSources(recommendation: Recommendation): readonly string[] {
  const out: string[] = [];
  const add = (value: string | undefined): void => {
    if (value === undefined) return;
    for (const part of value.split(';')) {
      const one = part.trim();
      if (one !== '' && !out.includes(one)) out.push(one);
    }
  };
  for (const line of recommendation.systemLines)
    for (const step of line.steps ?? []) add(step.source);
  for (const assumption of recommendation.assumptions) add(assumption.source);
  return out;
}
