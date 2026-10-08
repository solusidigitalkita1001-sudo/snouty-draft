/**
 * Pengklasifikasi tetangga terdekat: skor label = contoh terdekatnya; ambang dan selisih
 * menentukan "pasti" vs "ragu"; katalog multi-label mengembalikan semua yang lolos ambang.
 */
import { describe, expect, it } from 'vitest';
import { decide, dot, rank, type EmbeddedExample } from './classifier.js';

const v = (...values: number[]) => {
  const vec = Float32Array.from(values);
  const len = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
  return vec.map((x) => x / len);
};

const EXAMPLES: EmbeddedExample[] = [
  { label: 'a', text: 'a-jauh', vector: v(1, 0, 0) },
  { label: 'a', text: 'a-dekat', vector: v(0.9, 0.1, 0) },
  { label: 'b', text: 'b-satu', vector: v(0, 1, 0) },
  { label: 'c', text: 'c-satu', vector: v(0, 0, 1) },
];

describe('rank', () => {
  it('skor label adalah contoh TERDEKAT di label itu, dan contohnya disebut untuk diagnosis', () => {
    const ranked = rank(v(0.8, 0.2, 0), EXAMPLES);
    expect(ranked[0]).toMatchObject({ label: 'a', example: 'a-dekat' });
    expect(ranked.map((r) => r.label)).toEqual(['a', 'b', 'c']);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it('kosinus vektor ternormalisasi = hasil kali titik', () => {
    expect(dot(v(1, 0, 0), v(1, 0, 0))).toBeCloseTo(1);
    expect(dot(v(1, 0, 0), v(0, 1, 0))).toBeCloseTo(0);
  });
});

describe('decide', () => {
  it('label teratas yang lolos ambang dan selisih → pasti; di bawah ambang → ragu (null)', () => {
    const ranked = rank(v(0.95, 0.05, 0), EXAMPLES);
    expect(decide({ threshold: 0.9, margin: 0.05 }, ranked).best?.label).toBe('a');
    expect(decide({ threshold: 0.999, margin: 0 }, ranked).best).toBeNull();
  });

  it('dua label hampir sama skornya → ragu, bukan menebak yang teratas', () => {
    const ranked = rank(v(1, 1, 0), EXAMPLES);
    const verdict = decide({ threshold: 0.5, margin: 0.1 }, ranked);
    expect(verdict.best).toBeNull();
    // Keduanya tetap tercatat sebagai cocok untuk katalog multi-label.
    expect(verdict.matched.map((m) => m.label).sort()).toEqual(['a', 'b']);
  });

  it('contoh negatif (`none`) yang paling mirip → tidak ada keputusan, juga untuk multi-label', () => {
    const withNone: EmbeddedExample[] = [
      ...EXAMPLES,
      { label: 'none', text: 'bukan urusan katalog ini', vector: v(0.7, 0.7, 0.1) },
    ];
    const verdict = decide({ threshold: 0.5, margin: 0 }, rank(v(0.7, 0.7, 0.1), withNone));
    expect(verdict.best).toBeNull();
    expect(verdict.matched).toEqual([]);
    // `none` yang kalah tidak pernah dihitung cocok.
    const other = decide({ threshold: 0.5, margin: 0 }, rank(v(0, 0, 1), withNone));
    expect(other.best?.label).toBe('c');
    expect(other.matched.map((m) => m.label)).not.toContain('none');
  });

  it('multi-label: label lain ikut hanya di dalam jendela di bawah label teratas', () => {
    const ranked = rank(v(1, 0.55, 0), EXAMPLES); // a ≈ 0.88, b ≈ 0.48
    expect(
      decide({ threshold: 0.4, margin: 0, window: 1 }, ranked).matched.map((m) => m.label),
    ).toEqual(['a', 'b']);
    expect(
      decide({ threshold: 0.4, margin: 0, window: 0.2 }, ranked).matched.map((m) => m.label),
    ).toEqual(['a']);
  });

  it('tanpa contoh sama sekali → ragu, tanpa lemparan', () => {
    expect(decide({ threshold: 0.5, margin: 0 }, [])).toEqual({
      best: null,
      matched: [],
      ranked: [],
    });
  });
});
