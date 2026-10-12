/**
 * Versi aturan sebuah hasil hitung (temuan laporan SNTY-2026-10-0002: PDF dicetak dari
 * rekomendasi yang disusun aturan lama). Setiap trace menyimpan `ruleId` + `ruleVersion`; dari situ
 * dua hal diturunkan tanpa kolom baru di database:
 *
 *   - stempel: sidik pendek himpunan aturan yang dipakai, dicetak di laporan;
 *   - aturan usang: trace yang aturannya sudah naik versi atau sudah dihapus dari registry —
 *     hasil itu "dihitung dengan versi aturan lama".
 */
import { RULE_REGISTRY } from './registry.js';

export interface RuleUse {
  readonly ruleId: string;
  readonly ruleVersion: number | string;
}

/** "ENG-001@2", unik dan terurut. */
function uses(traces: readonly RuleUse[]): readonly string[] {
  return [...new Set(traces.map((t) => `${t.ruleId}@${Number(t.ruleVersion)}`))].sort();
}

/** Sidik 8 heksadesimal (FNV-1a 32-bit) dari himpunan aturan@versi — deterministik. */
export function rulesetStamp(traces: readonly RuleUse[]): string {
  let hash = 0x811c9dc5;
  for (const ch of uses(traces).join(' ')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Aturan yang dipakai hasil ini tetapi sudah naik versi atau dihapus; kosong = terkini. */
export function outdatedRules(traces: readonly RuleUse[]): readonly string[] {
  return uses(traces).filter((use) => {
    const [id, version] = use.split('@') as [string, string];
    const latest = RULE_REGISTRY.latest(id);
    return latest === null || latest.version !== Number(version);
  });
}
