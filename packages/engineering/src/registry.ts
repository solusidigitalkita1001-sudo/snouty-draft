/**
 * Registry berisi seluruh 14 aturan. docs/ENGINEERING_RULES.md §3.
 *
 * Dibangun saat modul dimuat, sehingga pelanggaran invarian R-1 (aturan tanpa tes)
 * akan menggagalkan impor — bukan menunggu sampai perhitungan berjalan.
 */

import { RuleRegistry, type AnyRule } from './rule.js';
import { GROUP_A } from './rules/group-a-load-sizing.js';
import { GROUP_B } from './rules/group-b-geometry.js';
import { GROUP_C } from './rules/group-c-material.js';
import { GROUP_D } from './rules/group-d-conversation.js';
import { GROUP_E } from './rules/group-e-irrigation.js';
import { GROUP_F } from './rules/group-f-pressurized.js';
import { GROUP_G } from './rules/group-g-pond.js';

/** 14 bangunan (A–D) + 5 irigasi (E) + 6 hidraulik bertekanan (F) + 4 kolam (G), Fase 14. */
export const ALL_RULES: readonly AnyRule[] = [
  ...GROUP_A,
  ...GROUP_B,
  ...GROUP_C,
  ...GROUP_D,
  ...GROUP_E,
  ...GROUP_F,
  ...GROUP_G,
] as unknown as readonly AnyRule[];

export const RULE_REGISTRY = new RuleRegistry();
for (const rule of ALL_RULES) {
  RULE_REGISTRY.register(rule);
}
