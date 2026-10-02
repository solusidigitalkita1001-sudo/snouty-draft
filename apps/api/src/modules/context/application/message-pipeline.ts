/**
 * MessagePipeline — satu giliran percakapan, dialirkan sebagai event SSE.
 * docs/CONTEXT_ENGINE.md §3 · docs/API_CONTRACTS.md §3.
 *
 * Fase 4 memiliki ruas pertama pipeline: **memahami kebutuhan**. Tahap
 * `ANALYZING_INSTALLATION` → `PREPARING_SCHEMATIC` adalah batas nyata milik
 * Engineering Engine (Fase 6) dan pipeline rekomendasi (Fase 7); pipeline ini
 * berhenti setelah `UNDERSTANDING` dengan kartu klarifikasi (data kurang) atau CTA
 * analisis (data lengkap), dan menyerahkan sisanya ke fase berikut. Memancarkan
 * tahap kosong di sini akan berbohong tentang batas yang belum ada.
 *
 * Dua jaminan yang diuji:
 *   - **Edit inline nol panggilan LLM** (`applyEdit`): nilainya sudah terstruktur.
 *   - Keluaran ekstraksi tak valid tidak pernah menjatuhkan giliran — ia jatuh ke
 *     klarifikasi (AI_BEHAVIOR).
 */

import type { AssistantStreamEvent, RequirementState, SnapshotTrigger } from '@snouty/shared-types';
import { AiOutputInvalidError } from '../../ai/domain/ai.errors.js';
import type { AiService } from '../../ai/domain/ai.port.js';
import { assumptionCard } from '../domain/requirement-defaults.js';
import { planClarification } from '../domain/clarification.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { withCompleteness } from '../domain/completeness.js';
import { fieldEntries } from '../domain/requirement-field.js';
import { extractionToUpdates } from './extraction-to-updates.js';
import type { RoutingDecision } from './intent-router.js';

export interface PipelineInput {
  readonly messageId: string;
  readonly message: string;
  readonly decision: RoutingDecision;
  readonly state: RequirementState;
  /** `now` disuntikkan demi kemurnian dan tes deterministik. */
  readonly now: string;
}

export interface PipelineResult {
  readonly events: readonly AssistantStreamEvent[];
  /** State akhir — pemanggil menyimpannya sebagai snapshot bila berubah. */
  readonly nextState: RequirementState;
  readonly changed: boolean;
  readonly trigger: SnapshotTrigger;
}

/**
 * Menjalankan ruas UNDERSTANDING dan mengumpulkan event. Tidak menyimpan apa pun —
 * persistensi (snapshot, pesan) dilakukan pemanggil di lapisan application supaya
 * transaksi dan urutan tulis tetap satu tempat.
 */
export async function runUnderstanding(
  ai: AiService | null,
  input: PipelineInput,
): Promise<PipelineResult> {
  const events: AssistantStreamEvent[] = [{ type: 'message.start', messageId: input.messageId }];

  if (!input.decision.shouldExtract) {
    // Penjelasan, lookup produk, di luar cakupan: bukan milik ruas ini. Diserahkan
    // ke fase berikut; Fase 4 hanya menutup giliran dengan bersih.
    events.push(endEvent(input.messageId));
    return { events, nextState: input.state, changed: false, trigger: 'extraction' };
  }

  events.push({ type: 'stage', stage: 'UNDERSTANDING', status: 'active' });

  let merged: RequirementState;
  let changed: boolean;
  try {
    if (!ai) throw new AiOutputInvalidError('extraction', 'AI tidak tersedia');
    const extraction = await ai.extract(input.message);
    const updates = extractionToUpdates(extraction);
    const result = mergeRequirement(input.state, updates, input.now);
    merged = withCompleteness(result.state);
    changed = result.changed.length > 0;
  } catch (error) {
    if (!(error instanceof AiOutputInvalidError)) throw error;
    // Ekstraksi gagal: jangan jatuhkan giliran. Minta klarifikasi atas yang kurang.
    events.push({ type: 'stage', stage: 'UNDERSTANDING', status: 'failed' });
    const plan = planClarification(input.state.missingInformation);
    if (plan)
      events.push({ type: 'card', card: { kind: 'clarification', questions: plan.questions } });
    events.push(endEvent(input.messageId));
    return { events, nextState: input.state, changed: false, trigger: 'extraction' };
  }

  events.push({ type: 'requirement.updated', state: merged });
  events.push({
    type: 'stage',
    stage: 'UNDERSTANDING',
    status: 'done',
    detail: `${merged.completeness.filled} DATA`,
  });

  if (merged.missingInformation.length > 0) {
    const plan = planClarification(merged.missingInformation);
    if (plan)
      events.push({ type: 'card', card: { kind: 'clarification', questions: plan.questions } });
  } else {
    // Data inti lengkap — ajak lanjut ke analisis (pipeline-nya di Fase 6/7).
    events.push({ type: 'card', card: { kind: 'cta', action: 'ANALYZE' } });
  }

  events.push(endEvent(input.messageId));

  const trigger: SnapshotTrigger = input.decision.mutatesState ? 'user_edit' : 'extraction';
  return { events, nextState: merged, changed, trigger };
}

function endEvent(messageId: string): AssistantStreamEvent {
  // Usage nyata diisi pemanggil dari audit biaya; di ruas tanpa model ia nol.
  return { type: 'message.end', messageId, usage: { in: 0, out: 0, costUsd: 0 } };
}

/** Kartu asumsi dari state — dipakai pemanggil saat merender ringkasan. */
export function assumptionCardFor(state: RequirementState) {
  return assumptionCard(fieldEntries(state));
}

/**
 * Edit inline ("Ubah" di panel kanan, "Perbaiki asumsi ini"). docs/CONTEXT_ENGINE.md §6.
 *
 * **Nol panggilan LLM**: nilainya sudah terstruktur, yang perlu hanya merge lalu
 * hitung ulang. Fungsi ini sengaja tidak menerima `AiService` — tidak ada yang bisa
 * dipanggil, sehingga jaminan "edit tidak memicu LLM" struktural.
 */
export function applyEdit(
  state: RequirementState,
  edits: ReadonlyArray<{
    path: Parameters<typeof mergeRequirement>[1][number]['path'];
    value: unknown;
  }>,
  now: string,
): { state: RequirementState; changed: boolean } {
  const result = mergeRequirement(
    state,
    edits.map((e) => ({ path: e.path, value: e.value, source: 'user_edited' as const })),
    now,
  );
  return { state: withCompleteness(result.state), changed: result.changed.length > 0 };
}
