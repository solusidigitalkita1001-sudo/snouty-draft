/**
 * Perencana giliran (P16-29): model membaca percakapan lalu MEMILIH TINDAKAN dari daftar tertutup;
 * kode yang menjalankan tindakan itu atas katalog dan state. Model tidak pernah menulis fakta di
 * sini — keluarannya hanya `{action, family, type, extreme}`, divalidasi skema dan dicocokkan ke
 * keluarga katalog yang benar-benar ada.
 *
 * Mengapa: pencocokan contoh mengenali kalimat yang BERDIRI SENDIRI, tetapi lanjutan yang maknanya
 * bergantung pada konteks ("kalau yang pvc?" setelah jenis HDPE, "paling kecil berapa?", "luasnya
 * ngaruh ga?") sering salah jalur — uji pemilik 2026-10-09: 7 dari 13 meleset. Membaca konteks
 * adalah tugas model (aturan proyek: pemahaman bahasa adalah tugas model).
 *
 * Gagal, lambat, atau keluaran tidak sah → `null`, dan giliran berjalan lewat router lama.
 */
import { z } from 'zod';
import type { Locale } from '@snouty/shared-types';
import type { ReplyCapableAi, ReplyTurn } from './reply-writer.js';
import type { MessageUnderstanding } from '../../understanding/application/message-understanding.js';

export const TURN_ACTIONS = [
  'product_types',
  'product_sizes',
  'product_overview',
  'product_question',
  'requirement',
  'case_question',
  'company',
  'chat',
] as const;
export type TurnAction = (typeof TURN_ACTIONS)[number];

const PlanSchema = z.object({
  action: z.enum(TURN_ACTIONS),
  family: z.string().trim().min(1).max(60).nullable().optional(),
  type: z.string().trim().min(1).max(80).nullable().optional(),
  extreme: z.enum(['smallest', 'largest']).nullable().optional(),
});

export interface TurnPlan {
  readonly action: TurnAction;
  /** Keluarga katalog yang SUDAH dicocokkan ke nama keluarga sebenarnya; `null` bila tidak ada. */
  readonly family: string | null;
  readonly type: string | null;
  readonly extreme: 'smallest' | 'largest' | null;
}

/** Turn terakhir yang dikirim ke model; jawaban panjang dipotong — cukup untuk konteks. */
const MAX_TURNS = 4;
const MAX_TURN_CHARS = 200;

const SYSTEM_PROMPT = [
  // Ringkas dengan sengaja: setiap token prompt ±25 ms di CPU server, tanpa cache (2026-10-09).
  'Pilih SATU tindakan untuk pesan terakhir pengguna aplikasi pipa Pralon. Jangan menjawabnya.',
  'product_types: jenis/tipe dalam satu keluarga ("HDPE ada tipe apa", "kalau yang pvc?").',
  'product_sizes: ukuran dalam keluarga/jenis; extreme=smallest/largest bila ditanya terkecil/terbesar.',
  'product_overview: ragam produk Pralon umum. product_question: spesifikasi/konsep produk lain.',
  'requirement: memberi/mengubah data bangunan. case_question: perhitungan, solusi, pengaruh suatu data, siapa yang menghitung, langkah berikutnya.',
  'company: perusahaan PT Pralon. chat: sapaan, siapa SNOUTY, terima kasih, keluhan, di luar pipa.',
  'family = nama persis dari DAFTAR KELUARGA atau null; rujukan ke percakapan sebelumnya memakai keluarga itu.',
  'JSON: {"action":"...","family":...,"type":...,"extreme":...}',
].join('\n');

export function buildPlannerMessage(input: {
  readonly message: string;
  readonly recentTurns: readonly ReplyTurn[];
  readonly families: readonly string[];
  readonly subject: string | null;
}): string {
  const parts = [`DAFTAR KELUARGA: ${input.families.join(', ')}`];
  if (input.subject) parts.push(`TOPIK AKTIF: ${input.subject}`);
  const turns = input.recentTurns.slice(-MAX_TURNS);
  if (turns.length > 0) {
    parts.push('PERCAKAPAN (tertua dulu):');
    for (const t of turns) {
      const text = t.text.replace(/\s+/g, ' ').slice(0, MAX_TURN_CHARS);
      parts.push(`${t.role === 'user' ? 'Pengguna' : 'SNOUTY'}: ${text}`);
    }
  }
  parts.push(`PESAN TERAKHIR PENGGUNA: ${input.message}`);
  return parts.join('\n');
}

/** Nama keluarga dari model → nama keluarga katalog yang ada (tanpa beda huruf/spasi). */
export function resolveFamily(
  proposed: string | null | undefined,
  families: readonly string[],
): string | null {
  if (!proposed) return null;
  const norm = (s: string) => s.toUpperCase().replace(/\s+/g, ' ').trim();
  const target = norm(proposed);
  return families.find((f) => norm(f) === target) ?? null;
}

/** Keluaran model → rencana sah; `null` bila tidak lolos skema. */
export function parsePlan(raw: unknown, families: readonly string[]): TurnPlan | null {
  const parsed = PlanSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    action: parsed.data.action,
    family: resolveFamily(parsed.data.family, families),
    type: parsed.data.type ?? null,
    extreme: parsed.data.extreme ?? null,
  };
}

/**
 * Intent yang maknanya utuh tanpa konteks percakapan — bila dikenali YAKIN dari contoh, perencana
 * dilewati (±10 s di CPU server). Lanjutan ("kalau yang…", "paling kecil…") tidak termasuk.
 */
const STANDALONE: ReadonlySet<string> = new Set([
  'company_question',
  'price_question',
  'competitor_question',
  'requirement_building',
  'requirement_irrigation',
  'requirement_technical',
  'product_range',
]);
export const CONFIDENT_SCORE = 0.85;

export function isConfidentStandalone(u: MessageUnderstanding): boolean {
  const intent = u.intent;
  if (intent === null || intent.score < CONFIDENT_SCORE) return false;
  if (STANDALONE.has(intent.label)) return true;
  // Ubahan kebutuhan yang menyebut bendanya ("tambah satu kamar mandi") juga utuh.
  return intent.label === 'requirement_mutation' && u.mentionsRequirement;
}

export class TurnPlanner {
  constructor(
    private readonly ai: ReplyCapableAi,
    private readonly timeoutMs: number,
  ) {}

  async plan(input: {
    readonly message: string;
    readonly recentTurns: readonly ReplyTurn[];
    readonly families: readonly string[];
    readonly subject: string | null;
    readonly locale: Locale;
  }): Promise<TurnPlan | null> {
    try {
      const raw = await this.ai.writeProse({
        systemPrompt: SYSTEM_PROMPT,
        userMessage: buildPlannerMessage(input),
        timeoutMs: this.timeoutMs,
        task: 'turn_planning',
      });
      return parsePlan(raw, input.families);
    } catch {
      return null;
    }
  }
}
