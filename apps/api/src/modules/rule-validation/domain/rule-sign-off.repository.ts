/**
 * Tanda tangan ahli domain atas satu versi aturan (P31-82, OQ-06).
 *
 * Disimpan per aturan + versi. Menaikkan versi berarti formulanya berubah, dan tanda tangan
 * atas formula lama tidak ikut pindah — itu yang membuat "laporan lama tetap bisa dijelaskan"
 * tetap benar setelah ada yang menandatangani.
 */

export const RULE_SIGN_OFF_DECISIONS = ['approved', 'rejected'] as const;
export type RuleSignOffDecision = (typeof RULE_SIGN_OFF_DECISIONS)[number];

export interface RuleSignOffRow {
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly decision: RuleSignOffDecision;
  readonly decidedBy: string;
  readonly decidedByName: string;
  readonly note: string | null;
  readonly decidedAt: Date;
}

export interface DecideRuleInput {
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly decision: RuleSignOffDecision;
  readonly decidedBy: string;
  readonly note: string | null;
}

export interface RuleSignOffRepository {
  list(): Promise<readonly RuleSignOffRow[]>;
  /** Menimpa keputusan sebelumnya atas versi yang sama — ahli boleh berubah pikiran. */
  decide(input: DecideRuleInput): Promise<void>;
  /** Mencabut tanda tangan: aturannya kembali menunggu, bukan ditolak. */
  withdraw(ruleId: string, ruleVersion: number): Promise<void>;
}

export const RULE_SIGN_OFF_REPOSITORY = Symbol('RuleSignOffRepository');
