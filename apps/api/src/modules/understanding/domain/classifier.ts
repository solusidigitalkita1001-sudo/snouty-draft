/**
 * Pengklasifikasi tetangga terdekat atas vektor contoh — fungsi murni.
 *
 * Skor sebuah label = kemiripan kosinus pesan dengan contoh TERDEKAT di label itu. Satu
 * contoh yang mirip sudah cukup — itulah cara kerja "contoh sebagai data": pemilik menambah
 * kalimat yang gagal dikenali, dan kalimat serupa berikutnya langsung dikenali.
 */
import type { Catalog } from './catalog.js';

export interface EmbeddedExample {
  readonly label: string;
  readonly text: string;
  readonly vector: Float32Array;
}

export interface LabelScore {
  readonly label: string;
  readonly score: number;
  /** Contoh yang memberi skor itu — untuk diagnosis "kenapa dikenali begini". */
  readonly example: string;
}

export interface Verdict {
  /** Label teratas bila melewati ambang DAN selisihnya cukup; `null` bila ragu. */
  readonly best: LabelScore | null;
  /** Semua label yang melewati ambang, tertinggi dulu (untuk katalog multi-label). */
  readonly matched: readonly LabelScore[];
  /** Peringkat lengkap, untuk diagnosis. */
  readonly ranked: readonly LabelScore[];
}

/** Kosinus dua vektor ternormalisasi = hasil kali titik. */
export function dot(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += a[i]! * b[i]!;
  return sum;
}

export function rank(query: Float32Array, examples: readonly EmbeddedExample[]): LabelScore[] {
  const best = new Map<string, LabelScore>();
  for (const example of examples) {
    const score = dot(query, example.vector);
    const current = best.get(example.label);
    if (!current || score > current.score) {
      best.set(example.label, { label: example.label, score, example: example.text });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

export function decide(
  catalog: Pick<Catalog, 'threshold' | 'margin'>,
  ranked: readonly LabelScore[],
): Verdict {
  const matched = ranked.filter((r) => r.score >= catalog.threshold);
  const top = ranked[0];
  const second = ranked[1];
  const certain =
    top !== undefined &&
    top.score >= catalog.threshold &&
    (second === undefined || top.score - second.score >= catalog.margin);
  return { best: certain ? top : null, matched, ranked };
}
