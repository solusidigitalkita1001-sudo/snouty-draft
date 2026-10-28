/**
 * Validasi aturan teknik (P31-82, OQ-06/P16-69).
 *
 * Sampai hari ini layar ini hanya memuat satu paragraf yang mengatakan ia menunggu seseorang.
 * Yang ditunggu memang orang — tetapi tanpa layar yang benar-benar menampilkan aturannya,
 * orang itu tidak punya apa pun untuk ditandatangani.
 *
 * Yang ditampilkan ke ahli semuanya berasal dari aturannya sendiri: versinya, kode plambing
 * atau metode yang menjadi sumbernya, dan satu contoh kerja yang diambil dari **test case**
 * aturan itu — masukan, keluaran, dan kalimat `explain` yang sama persis dengan yang dibaca
 * pengguna di layar solusi. Tidak ada satu pun angka di layar ini yang dikarang di sini.
 *
 * `sourceReference` sengaja TIDAK ditampilkan: isinya catatan pembangunan ("kartu asumsi
 * prototipe", "board layar 08") yang tidak berarti apa pun bagi orang Pralon.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ALL_RULES,
  type AnyRule,
  type EngineeringLocale,
  type RuleValidationStatus,
} from '@snouty/engineering';
import { priorityIndex, PRIORITY_RULES } from '../domain/priority-rules.js';
import {
  RULE_SIGN_OFF_REPOSITORY,
  type RuleSignOffDecision,
  type RuleSignOffRepository,
  type RuleSignOffRow,
} from '../domain/rule-sign-off.repository.js';

export interface RuleExample {
  readonly name: string;
  readonly input: unknown;
  readonly output: unknown;
  /** Kalimat "dasar perhitungan" aturan ini — sama dengan yang dibaca pengguna. */
  readonly explanation: string;
}

export interface RuleCard {
  readonly ruleId: string;
  readonly version: number;
  readonly category: string;
  /** Kode plambing atau metode yang memberi angkanya; null untuk aritmetika biasa. */
  readonly standard: string | null;
  /** Status yang berlaku sekarang: status kode, kecuali ada tanda tangan atas versi ini. */
  readonly status: RuleValidationStatus;
  /** Mengapa aturan ini diminta dibaca lebih dulu; null untuk yang tidak prioritas. */
  readonly why: string | null;
  readonly examples: readonly RuleExample[];
  readonly decision: {
    readonly decision: RuleSignOffDecision;
    readonly by: string;
    readonly at: string;
    readonly note: string | null;
  } | null;
}

export interface RuleBoard {
  readonly priority: readonly RuleCard[];
  readonly rest: readonly RuleCard[];
  readonly signedOff: number;
  readonly total: number;
}

/** Dua contoh sudah cukup untuk menilai sebuah formula; sepuluh membuat layarnya tidak dibaca. */
const EXAMPLES_SHOWN = 2;

@Injectable()
export class RuleValidationService {
  constructor(@Inject(RULE_SIGN_OFF_REPOSITORY) private readonly signOffs: RuleSignOffRepository) {}

  async board(locale: EngineeringLocale): Promise<RuleBoard> {
    const decisions = indexDecisions(await this.signOffs.list());
    const cards = latestRules().map((rule) => toCard(rule, decisions, locale));
    const priorityIds = new Set(PRIORITY_RULES.map((rule) => rule.ruleId));
    return {
      priority: cards
        .filter((card) => priorityIds.has(card.ruleId))
        .sort((a, b) => priorityIndex(a.ruleId) - priorityIndex(b.ruleId)),
      rest: cards.filter((card) => !priorityIds.has(card.ruleId)),
      signedOff: cards.filter((card) => card.status === 'VALIDATED').length,
      total: cards.length,
    };
  }

  /**
   * Menandatangani — atau menolak — satu versi aturan.
   *
   * Versinya ikut dikirim pemanggil dan dicocokkan dengan versi yang sedang berlaku: tanda
   * tangan atas formula yang sudah berubah di antara layar dibuka dan tombol ditekan adalah
   * tanda tangan atas sesuatu yang tidak pernah dibaca penandatangannya.
   */
  async decide(input: {
    readonly ruleId: string;
    readonly ruleVersion: number;
    readonly decision: RuleSignOffDecision;
    readonly note: string | null;
    readonly actorId: string;
  }): Promise<'ok' | 'unknown_rule' | 'stale_version'> {
    const rule = latestRules().find((candidate) => candidate.ruleId === input.ruleId);
    if (!rule) return 'unknown_rule';
    if (rule.version !== input.ruleVersion) return 'stale_version';

    await this.signOffs.decide({
      ruleId: input.ruleId,
      ruleVersion: input.ruleVersion,
      decision: input.decision,
      decidedBy: input.actorId,
      note: input.note,
    });
    return 'ok';
  }

  /**
   * Keputusan yang sudah diambil, sependek mungkin — dipakai tepi hitungan untuk menaikkan
   * provenance nilai yang aturannya sudah ditandatangani (P31-83). Sengaja bukan `board()`:
   * jalur hitung tidak perlu contoh kerja dan alasan prioritas.
   */
  async decisions(): Promise<
    readonly {
      readonly ruleId: string;
      readonly ruleVersion: number;
      readonly decision: 'approved' | 'rejected';
    }[]
  > {
    const rows = await this.signOffs.list();
    return rows.map((row) => ({
      ruleId: row.ruleId,
      ruleVersion: row.ruleVersion,
      decision: row.decision,
    }));
  }

  async withdraw(ruleId: string, ruleVersion: number): Promise<void> {
    await this.signOffs.withdraw(ruleId, ruleVersion);
  }
}

/** Versi tertinggi tiap aturan — yang dipakai hitungan baru, dan yang ditandatangani. */
function latestRules(): readonly AnyRule[] {
  const latest = new Map<string, AnyRule>();
  for (const rule of ALL_RULES) {
    const seen = latest.get(rule.ruleId);
    if (!seen || rule.version > seen.version) latest.set(rule.ruleId, rule);
  }
  return [...latest.values()];
}

function indexDecisions(rows: readonly RuleSignOffRow[]): Map<string, RuleSignOffRow> {
  return new Map(rows.map((row) => [`${row.ruleId}@${row.ruleVersion}`, row]));
}

function toCard(
  rule: AnyRule,
  decisions: Map<string, RuleSignOffRow>,
  locale: EngineeringLocale,
): RuleCard {
  const signed = decisions.get(`${rule.ruleId}@${rule.version}`) ?? null;
  const priority = PRIORITY_RULES.find((item) => item.ruleId === rule.ruleId) ?? null;
  return {
    ruleId: rule.ruleId,
    version: rule.version,
    category: rule.category,
    standard: rule.standard ?? null,
    status: statusOf(rule.validationStatus, signed),
    why: priority === null ? null : locale === 'en' ? priority.whyEn : priority.why,
    examples: rule.testCases
      .slice(0, EXAMPLES_SHOWN)
      .map((testCase) => example(rule, testCase, locale)),
    decision:
      signed === null
        ? null
        : {
            decision: signed.decision,
            by: signed.decidedByName,
            at: signed.decidedAt.toISOString(),
            note: signed.note,
          },
  };
}

/**
 * Status yang berlaku. Tanda tangan hanya bisa menaikkan aturan yang memang menunggu — sebuah
 * aturan yang di kode sudah `REJECTED` tidak bisa dihidupkan lewat basis data.
 */
function statusOf(code: RuleValidationStatus, signed: RuleSignOffRow | null): RuleValidationStatus {
  if (code === 'REJECTED' || signed === null) return code;
  return signed.decision === 'approved' ? 'VALIDATED' : 'REJECTED';
}

function example(
  rule: AnyRule,
  testCase: AnyRule['testCases'][number],
  locale: EngineeringLocale,
): RuleExample {
  return {
    name: testCase.name,
    input: testCase.input,
    output: testCase.expected,
    explanation: rule.explain(testCase.input, testCase.expected, locale),
  };
}
