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

import type {
  AssistantCard,
  AssistantStreamEvent,
  KeyValue,
  RequirementState,
  SnapshotTrigger,
} from '@snouty/shared-types';
import { AiOutputInvalidError } from '../../ai/domain/ai.errors.js';
import type { AiService } from '../../ai/domain/ai.port.js';
import type { Extraction } from '../../ai/domain/extraction-schema.js';
import { streamedEvents, type EventSink } from '../../../shared/sse/event-stream.js';
import { caseProfile, isCaseId } from '@snouty/engineering';
import { policyCard } from '../../policy/policy-cards.js';
import {
  competitorPolicy,
  scopePolicy,
  technicalHandoffPolicy,
  useCasePolicy,
} from '../../policy/scope.js';
import {
  applyTechnicalFacts,
  detectTechnicalCase,
  isTechnicalComplete,
  planTechnicalClarification,
  technicalCaptured,
  technicalGuidance,
} from '../domain/technical.js';
import {
  applyIrrigationAnswers,
  irrigationCaptured,
  irrigationFactsFrom,
  isIrrigationComplete,
  isIrrigationMessage,
  planIrrigationClarification,
} from '../domain/irrigation.js';
import { irrigationGuidance } from './irrigation-guidance.js';
import { assumptionCard } from '../domain/requirement-defaults.js';
import { planClarification } from '../domain/clarification.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { withCompleteness } from '../domain/completeness.js';
import { fieldEntries } from '../domain/requirement-field.js';
import { asksAdvice } from '../domain/message-signals.js';
import { FIELD_LABEL, requirementValueLabel } from '../domain/requirement-labels.js';
import { extractionToUpdates } from './extraction-to-updates.js';
import type { RoutingDecision } from './intent-router.js';
import { adviseMaterials, materialsIn } from './pipe-knowledge.js';
import { OPENER_REPLY, replyFor } from './reply-copy.js';
import type { ReplyTurn, ReplyWriter } from './reply-writer.js';

export interface PipelineInput {
  readonly messageId: string;
  readonly message: string;
  readonly decision: RoutingDecision;
  readonly state: RequirementState;
  /** `now` disuntikkan demi kemurnian dan tes deterministik. */
  readonly now: string;
  /** Giliran terakhir untuk balasan yang nyambung — hanya dipakai ruas tanpa ekstraksi. */
  readonly recentTurns?: readonly ReplyTurn[];
  /** Sink SSE: setiap event dikirim saat terjadi (P14-07), array hasil tetap lengkap. */
  readonly emit?: EventSink;
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
  reply: ReplyWriter | null = null,
): Promise<PipelineResult> {
  const events = streamedEvents(input.emit, [
    { type: 'message.start', messageId: input.messageId },
  ]);

  // Policy 1 DULU, sebelum apa pun: pertanyaan kompetitor dijawab kriteria netral dan
  // tidak pernah masuk jalur rekomendasi. Memeriksanya di sini — bukan setelah
  // ekstraksi — berarti tidak ada jalan ia tercampur dengan pencocokan produk.
  if (input.decision.intent === 'COMPETITOR_QUESTION') {
    const card = policyCard(competitorPolicy());
    if (card) events.push({ type: 'card', card });
    events.push(endEvent(input.messageId));
    return { events, nextState: input.state, changed: false, trigger: 'extraction' };
  }

  if (!input.decision.shouldExtract) {
    // Sapaan/di luar topik, minta penjelasan, atau model ragu: bukan ruas ekstraksi,
    // tetapi tetap dijawab — giliran yang ditutup tanpa sepatah kata terbaca sebagai
    // kerusakan. (Lookup produk punya ruasnya sendiri sebelum sampai ke sini.)
    const fallback = replyFor(input.decision.intent);
    if (fallback !== null) {
      // Dengan model: balasan ditulis model dari konteks percakapan, tanpa fakta teknis
      // (tidak ada DATA → nol angka). Tanpa model, atau bila pagar menolak: teks tetap.
      // Permintaan penjelasan ("kenapa 1 inci?") TIDAK diserahkan ke model: tanpa DATA ia
      // mengarang alasan teknik yang terdengar masuk akal (produksi 2026-10-07, 7B: "ukuran 1
      // inci dioptimalkan untuk kebutuhan air cukup besar"). Dasarnya ada di solusi; teks tetap.
      const written =
        reply && input.decision.intent !== 'EXPLANATION_REQUEST'
          ? await reply.write({
              intent: input.decision.intent,
              userMessage: input.message,
              recentTurns: input.recentTurns ?? [],
              fallback,
            })
          : { text: fallback };
      events.push({ type: 'token', text: written.text });
    }
    events.push(endEvent(input.messageId));
    return { events, nextState: input.state, changed: false, trigger: 'extraction' };
  }

  // Jalur IRIGASI (OQ-47): alur yang sama seperti rumah — fakta tersurat dicatat, arahan
  // diberikan, yang kurang ditanya lewat kartu — tetapi muaranya handoff terstruktur, bukan
  // sizing otomatis. Nol LLM: pertanyaannya tertutup, faktanya dari bentuk kalimat.
  if (isIrrigationMessage(input.message) || input.state.useCase?.kind === 'irrigation') {
    const applied = applyIrrigationAnswers(input.state, irrigationFactsFrom(input.message));
    events.push({ type: 'requirement.updated', state: applied.state });
    events.push({ type: 'token', text: irrigationGuidance(applied.state) });
    const card = irrigationFollowUp(applied.state);
    if (card) events.push({ type: 'card', card });
    events.push(endEvent(input.messageId));
    return {
      events,
      nextState: applied.state,
      changed: applied.changed,
      trigger: 'extraction',
    };
  }

  // Guna di luar cakupan (air panas, cairan proses) diputuskan dari pesannya SEBELUM apa pun:
  // tidak ada field yang mewakilinya, dan kartu klarifikasi "berapa kamar mandi?" adalah
  // jawaban yang salah untuknya. Kebijakan menang atas klasifikasi kasus — "air panas boiler
  // hotel" bukan kasus gedung bertingkat. State tidak disentuh.
  const useCase = useCasePolicy(input.message);
  if (useCase.kind === 'policy') {
    const card = policyCard(useCase, capturedFrom(input.state));
    if (card) events.push({ type: 'card', card });
    events.push(endEvent(input.messageId));
    return { events, nextState: input.state, changed: false, trigger: 'extraction' };
  }

  // Jalur KASUS TEKNIS UMUM (Fase 14): kolam/tambak, transfer pompa, gravitasi, air hujan,
  // gorong-gorong, sumur, cluster, gedung. Fakta tersurat → parameter universal; yang kurang
  // ditanya dengan redaksi registry; kalkulator per kasus — sampai ada, muaranya validasi
  // teknis terstruktur. Nol LLM.
  const technicalCase = detectTechnicalCase(input.message, input.state);
  if (technicalCase !== null) {
    const applied = applyTechnicalFacts(input.state, technicalCase, input.message);
    events.push({ type: 'requirement.updated', state: applied.state });
    events.push({ type: 'token', text: technicalGuidance(applied.state) });
    const card = technicalFollowUp(applied.state);
    if (card) events.push({ type: 'card', card });
    events.push(endEvent(input.messageId));
    return {
      events,
      nextState: applied.state,
      changed: applied.changed,
      trigger: 'extraction',
    };
  }

  events.push({ type: 'stage', stage: 'UNDERSTANDING', status: 'active' });

  let merged: RequirementState;
  let changed: boolean;
  try {
    if (!ai) throw new AiOutputInvalidError('extraction', 'AI tidak tersedia');
    const extraction = await ai.extract(input.message);

    // Pesan pembuka tanpa satu pun fakta ("mau nanya2 dong", "boleh tanya?"): model kecil kerap
    // memberinya label REQUIREMENT_STATEMENT, dan formulir klarifikasi adalah jawaban yang salah
    // untuk orang yang baru hendak bertanya. Ekstraksi kosong berarti tidak ada yang bisa
    // diklarifikasi dari pesan ini — dijawab seperti percakapan. Hanya untuk pernyataan pertama:
    // jawaban klarifikasi dan mutasi yang kosong tetap lewat jalur biasa.
    // Kosong dinilai SETELAH fakta tersurat dari teks ikut dihitung (`extractionToUpdates`):
    // "rumah 2 lantai, tidak ada dapur" dengan model yang mengembalikan {} bukan pembuka
    // (produksi 2026-10-07 — sempat dijawab "silakan tanyakan saja").
    const updates = extractionToUpdates(extraction, input.message);
    if (
      input.decision.intent === 'REQUIREMENT_STATEMENT' &&
      isEmptyExtraction(extraction) &&
      updates.length === 0
    ) {
      events.push({ type: 'stage', stage: 'UNDERSTANDING', status: 'done', detail: '0 DATA' });
      const written = reply
        ? await reply.write({
            intent: 'OUT_OF_SCOPE',
            userMessage: input.message,
            recentTurns: input.recentTurns ?? [],
            fallback: OPENER_REPLY,
          })
        : { text: OPENER_REPLY };
      events.push({ type: 'token', text: written.text });
      events.push(endEvent(input.messageId));
      return { events, nextState: input.state, changed: false, trigger: 'extraction' };
    }

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

  // Pertanyaan REKOMENDASI bahan ("lebih bagus PVC atau HDPE buat rumah 2 lantai?"): kebutuhannya
  // tetap diekstrak seperti biasa, tetapi pertanyaannya dijawab — bukan diam lalu menyodorkan
  // formulir, dan bukan mengulang penjelasan bahan. Teks dari pengetahuan milik kode.
  const materials = asksAdvice(input.message) ? materialsIn(input.message) : [];
  if (materials.length > 0) {
    events.push({
      type: 'token',
      text: adviseMaterials(materials, {
        buildingLabel: buildingLabel(merged.building.type.value),
        floors: merged.building.floors.value,
        needsMoreData: merged.missingInformation.length > 0,
      }),
    });
  }

  const card = followUpCard(merged);
  if (card) events.push({ type: 'card', card });

  events.push(endEvent(input.messageId));

  const trigger: SnapshotTrigger = input.decision.mutatesState ? 'user_edit' : 'extraction';
  return { events, nextState: merged, changed, trigger };
}

/**
 * Kartu lanjutan atas state yang SUDAH di-merge — dipakai setelah ekstraksi maupun setelah
 * jawaban klarifikasi, supaya keduanya bermuara di keputusan yang sama:
 *
 *   - Policy 5: scope diputuskan dari kebutuhan nyata, bukan dari kata-kata pesan. Industri
 *     atau pembuangan tidak boleh sampai ke CTA analisis, karena analisisnya belum ada.
 *   - Masih ada field inti kosong → kartu klarifikasi (maks. 4 pertanyaan).
 *   - Lengkap dan dalam cakupan → ajak lanjut ke analisis (Fase 6/7).
 */
export function followUpCard(merged: RequirementState): AssistantCard | null {
  if (merged.useCase?.kind === 'irrigation') return irrigationFollowUp(merged);
  if (merged.useCase?.kind === 'technical') return technicalFollowUp(merged);
  const scope = scopePolicy({
    buildingType: merged.building.type.value,
    installationType: merged.water.installationType.value,
    floors: merged.building.floors.value,
  });
  if (scope.kind === 'policy') return policyCard(scope, capturedFrom(merged));
  if (merged.missingInformation.length > 0) {
    const plan = planClarification(merged.missingInformation);
    return plan ? { kind: 'clarification', questions: plan.questions } : null;
  }
  return { kind: 'cta', action: 'ANALYZE' };
}

/**
 * Irigasi: masih ada yang kurang → kartu pertanyaan irigasi; lengkap → CTA "Susun
 * rekomendasi" — mesin irigasi (Kelompok E) menghitungnya, semua bertanda asumsi sampai
 * divalidasi (OQ-47). Handoff ke tim teknis tetap tersedia dari layar solusi.
 */
function irrigationFollowUp(state: RequirementState): AssistantCard | null {
  if (!isIrrigationComplete(state)) {
    const questions = planIrrigationClarification(state);
    return questions.length > 0 ? { kind: 'clarification', questions } : null;
  }
  return { kind: 'cta', action: 'ANALYZE' };
}

/**
 * Kasus teknis: masih ada parameter kritis kosong → kartu pertanyaan berpilihan (angka ditanya
 * di teks); lengkap → validasi teknis terstruktur sampai kalkulator kasusnya tersedia.
 */
function technicalFollowUp(state: RequirementState): AssistantCard | null {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return null;
  if (!isTechnicalComplete(state)) {
    const { card } = planTechnicalClarification(state);
    return card.length > 0 ? { kind: 'clarification', questions: card } : null;
  }
  const profile = caseProfile(state.useCase.caseId);
  if (profile.calculatorStatus === 'available') return { kind: 'cta', action: 'ANALYZE' };
  return policyCard(technicalHandoffPolicy(profile.label), capturedFrom(state));
}

/**
 * Kebutuhan yang sudah terkumpul, untuk dibawa ke kartu validasi teknis dan antrean tim
 * teknis — supaya pengguna tidak mengulang ceritanya dari nol. Bahasa pengguna, bukan path.
 */
export function capturedFrom(state: RequirementState): readonly KeyValue[] {
  const rows: KeyValue[] = [];
  for (const [path, field] of fieldEntries(state)) {
    if (field.value !== null) {
      rows.push({ label: FIELD_LABEL[path], value: requirementValueLabel(path, field.value) });
    }
  }
  return [...rows, ...irrigationCaptured(state), ...technicalCaptured(state)];
}

/** Label bangunan untuk kalimat — mengikuti salinan laporan (`report-assembler.ts`). */
function buildingLabel(type: RequirementState['building']['type']['value']): string | null {
  switch (type) {
    case 'residential':
      return 'rumah tinggal';
    case 'boarding_house':
      return 'rumah kos';
    case 'light_commercial':
      return 'bangunan komersial ringan';
    case 'industrial':
      return 'bangunan industri';
    default:
      return null;
  }
}

/**
 * Ekstraksi tanpa satu pun field terisi. Grup yang ada tetapi kosong (`building: {}`) dihitung
 * kosong juga — model sering mengembalikan kerangka skema tanpa isi.
 */
export function isEmptyExtraction(extraction: Extraction): boolean {
  return Object.values(extraction).every(
    (group) => group === undefined || Object.values(group).every((value) => value === undefined),
  );
}

export function endEvent(messageId: string): AssistantStreamEvent {
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
