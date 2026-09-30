/**
 * Engineering Rule Engine — TypeScript murni, tanpa I/O, tanpa framework.
 *
 * Paket ini sengaja tidak punya dependensi runtime. Itu yang membuat SPEC §25
 * ("perhitungan teknik tidak pernah memanggil LLM") benar secara struktural:
 * tidak ada apa pun untuk dipanggil. Dijaga oleh scripts/check-engineering-isolation.mjs.
 *
 * Aturan sebenarnya menyusul di Fase 6 (docs/ENGINEERING_RULES.md). Seluruh 14
 * aturan akan lahir dengan status REQUIRES_DOMAIN_VALIDATION sampai ahli domain
 * Pralon menandatanganinya (OQ-06).
 */

export type RuleValidationStatus = 'REQUIRES_DOMAIN_VALIDATION' | 'VALIDATED' | 'REJECTED';

export interface RuleVersionMeta {
  readonly ruleId: string;
  readonly version: number;
  readonly validationStatus: RuleValidationStatus;
  readonly sourceReference?: string;
}

/** Registry kosong sampai Fase 6. */
export const RULE_REGISTRY: readonly RuleVersionMeta[] = [];
