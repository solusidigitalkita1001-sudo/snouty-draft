/**
 * Mutasi RELATIF jumlah (P16-12): "tambah satu kamar mandi" atas state 3 kamar mandi berarti 4,
 * bukan 1. Arah (tambah/kurangi) dikenali modul `understanding` dari contoh; angkanya dibaca
 * parser nilai dari teks — tanpa angka berarti satu. Fungsi murni: tidak menyentuh model.
 *
 * Hanya field JUMLAH yang relatif; field lain (sumber air, jenis bangunan) tetap absolut.
 */
import type { RequirementFieldPath, RequirementState } from '@snouty/shared-types';
import type { MutationOpLabel } from '../../understanding/domain/labels.js';
import { COUNT_NOUNS, mentionsCount } from '../application/extraction-to-updates.js';
import type { FieldUpdate } from './context-merger.js';
import { readField } from './requirement-field.js';

/** Kata benda jumlah disebut di pesan (dengan atau tanpa angka). */
function mentionsNoun(message: string, noun: string): boolean {
  return new RegExp(`\\b(?:${noun})\\b`, 'i').test(message);
}

export function applyRelativeCounts(
  updates: readonly FieldUpdate[],
  message: string,
  state: RequirementState,
  op: MutationOpLabel | null,
): FieldUpdate[] {
  if (op === null) return [...updates];
  const sign = op === 'add' ? 1 : -1;
  const out: FieldUpdate[] = [];
  const handled = new Set<RequirementFieldPath>();
  // Yang diubah adalah yang jumlahnya terbaca dari pesan ini. "mau nambah 1 kamar mandi di lantai
  // 2" menambah kamar mandi — "lantai" di situ letaknya, bukan yang ditambah — tetapi dulu setiap
  // kata benda jumlah yang DISEBUT ikut naik satu, sehingga rumah 2 lantai menjadi 3 lantai
  // (produksi 2026-11-02). Bila pesan tidak memuat satu jumlah pun ("kurangi kamar mandinya"),
  // semua yang disebut tetap dihitung relatif seperti sebelumnya.
  const stated = new Set(
    updates
      .filter((u) => typeof u.value === 'number' && u.path in COUNT_NOUNS)
      .map((u) => u.path as RequirementFieldPath),
  );

  for (const [path, noun] of Object.entries(COUNT_NOUNS) as [RequirementFieldPath, string][]) {
    if (!mentionsNoun(message, noun)) continue;
    if (stated.size > 0 && !stated.has(path)) continue;
    const absolute = updates.find((u) => u.path === path);
    // Angka di pesan adalah DELTA ("tambah 2 titik air"); tanpa angka, satu. `mentionsCount`
    // memastikan angkanya memang berdekatan dengan kata bendanya.
    const delta =
      absolute && typeof absolute.value === 'number' && mentionsCount(message, absolute.value, noun)
        ? absolute.value
        : 1;
    const current = readField(state, path).value;
    const base = typeof current === 'number' ? current : 0;
    out.push({ path, value: Math.max(0, base + sign * delta), source: 'user_stated' });
    handled.add(path);
  }

  for (const update of updates) if (!handled.has(update.path)) out.push(update);
  return out;
}
