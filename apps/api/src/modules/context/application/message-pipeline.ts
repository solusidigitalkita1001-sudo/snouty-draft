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
import { AiOutputInvalidError, LlmUnavailableError } from '../../ai/domain/ai.errors.js';
import type { AiService } from '../../ai/domain/ai.port.js';
import type { Extraction } from '../../ai/domain/extraction-schema.js';
import { CORE_REQUIREMENT_FIELDS, DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import { loadEnv } from '../../../config/env.js';
import { streamedEvents, type EventSink } from '../../../shared/sse/event-stream.js';
import { caseProfile, caseProfileLabel, isCaseId } from '@snouty/engineering';
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
import { requirementFieldLabel, requirementValueLabel } from '../domain/requirement-labels.js';
import type { MessageUnderstanding } from '../../understanding/application/message-understanding.js';
import { applyRelativeCounts } from '../domain/relative-counts.js';
import { extractionToUpdates } from './extraction-to-updates.js';
import type { RoutingDecision } from './intent-router.js';
import { adviseMaterials, materialsFor } from './pipe-knowledge.js';
import { productAnswerCopy } from './product-answer-text.js';
import { openerReply, outOfTopicReply, replyFor } from './reply-copy.js';
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
  /** Bahasa percakapan (Fase 15) — untuk balasan model; teks deterministik menyusul per item. */
  readonly locale?: Locale;
  /**
   * Hasil pemahaman pesan (P16-11): permintaan rekomendasi bahan dan keluarga produk yang disebut
   * dibaca dari sini, bukan dari pola kalimat. Opsional supaya jalur edit/jawaban kartu tak berubah.
   */
  readonly understanding?: MessageUnderstanding;
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
  const locale = input.locale ?? DEFAULT_LOCALE;

  // Policy 1 DULU, sebelum apa pun: pertanyaan kompetitor dijawab kriteria netral dan
  // tidak pernah masuk jalur rekomendasi. Memeriksanya di sini — bukan setelah
  // ekstraksi — berarti tidak ada jalan ia tercampur dengan pencocokan produk.
  if (input.decision.intent === 'COMPETITOR_QUESTION') {
    const card = policyCard(competitorPolicy(locale), [], locale);
    if (card) events.push({ type: 'card', card });
    events.push(endEvent(input.messageId));
    return { events, nextState: input.state, changed: false, trigger: 'extraction' };
  }

  if (!input.decision.shouldExtract) {
    // Sapaan/di luar topik, minta penjelasan, atau model ragu: bukan ruas ekstraksi,
    // tetapi tetap dijawab — giliran yang ditutup tanpa sepatah kata terbaca sebagai
    // kerusakan. (Lookup produk punya ruasnya sendiri sebelum sampai ke sini.)
    const fallback =
      input.understanding?.intent?.label === 'out_of_scope'
        ? outOfTopicReply(input.locale)
        : replyFor(input.decision.intent, input.locale);
    if (fallback !== null) {
      // Teks tetap, tanpa model. Dulu sapaan/di luar topik diserahkan ke model (tanpa DATA → nol
      // angka); di CPU itu 40–50 detik untuk sebuah sapaan (diet panggilan model, 2026-10-07).
      // Permintaan penjelasan ("kenapa 1 inci?") memang tidak pernah ke model: tanpa DATA ia
      // mengarang alasan teknik yang terdengar masuk akal. Dasarnya ada di solusi.
      // `ReplyWriter` tetap tersedia untuk model yang lebih cepat (`LLM_CHAT_REPLY`).
      const written =
        reply && loadEnv().LLM_CHAT_REPLY && input.decision.intent !== 'EXPLANATION_REQUEST'
          ? await reply.write({
              intent: input.decision.intent,
              userMessage: input.message,
              recentTurns: input.recentTurns ?? [],
              ...(input.locale ? { locale: input.locale } : {}),
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
    events.push({ type: 'token', text: irrigationGuidance(applied.state, locale) });
    const card = irrigationFollowUp(applied.state, locale);
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
  const useCase = useCasePolicy(input.message, locale);
  if (useCase.kind === 'policy') {
    const card = policyCard(useCase, capturedFrom(input.state, locale), locale);
    if (card) events.push({ type: 'card', card });
    events.push(endEvent(input.messageId));
    return { events, nextState: input.state, changed: false, trigger: 'extraction' };
  }

  // Jalur KASUS TEKNIS UMUM (Fase 14): kolam/tambak, transfer pompa, gravitasi, air hujan,
  // gorong-gorong, sumur, cluster, gedung. Fakta tersurat → parameter universal; yang kurang
  // ditanya dengan redaksi registry; kalkulator per kasus — sampai ada, muaranya validasi
  // teknis terstruktur. Nol LLM.
  // Kebutuhan BANGUNAN yang menyebut sumur/pompa sebagai sumber air ("boarding house, 3 floors,
  // 12 bathrooms, water from a well with a pump") bukan kasus distribusi sumur — bentuk kalimatnya
  // dikenali pemahaman; kasus teknis yang sudah berjalan tetap dilanjutkan (audit live 2026-10-08).
  const buildingNeed =
    input.understanding?.intent?.label === 'requirement_building' &&
    input.state.useCase?.kind !== 'technical';
  const technicalCase = buildingNeed ? null : detectTechnicalCase(input.message, input.state);
  if (technicalCase !== null) {
    const applied = applyTechnicalFacts(input.state, technicalCase, input.message);
    events.push({ type: 'requirement.updated', state: applied.state });
    // Kalimat pembuka kasus hanya di giliran pertama; giliran berikutnya langsung data + pertanyaan.
    const firstTurn = input.state.useCase?.kind !== 'technical';
    events.push({
      type: 'token',
      text: technicalGuidance(applied.state, locale, { withIntro: firstTurn }),
    });
    const card = technicalFollowUp(applied.state, locale);
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

  // Ekstraksi model boleh gagal; giliran tidak boleh. Fakta tersurat dari teks (lantai, kamar
  // mandi, letak toren, peniadaan) tetap terbaca lewat `extractionToUpdates({}, pesan)`, dan bila
  // itu pun kosong, kartu klarifikasi — BUKAN giliran yang berakhir tanpa sepatah kata
  // (produksi 2026-10-07: ekstraksi gagal dua kali, `missingInformation` state awal kosong,
  // kartu tidak terbit, pengguna menatap layar kosong).
  let extraction: Extraction = {};
  let extractionFailed = false;
  // Diet panggilan model (produksi 2026-10-07: ekstraksi 7B rata-rata 103 s, dan 9 dari 16 kali
  // diulang). Bila fakta tersurat di teks sudah memberi minimal dua dari empat data inti (lantai,
  // kamar mandi, sumber air, jenis instalasi), model tidak dipanggil: sisanya ditanya kartu
  // klarifikasi, yang memang jalur biasa — jauh lebih cepat daripada menunggu tebakan model.
  const quickCore = extractionToUpdates({}, input.message).filter((u) =>
    CORE_REQUIREMENT_FIELDS.includes(u.path as (typeof CORE_REQUIREMENT_FIELDS)[number]),
  ).length;
  // Mutasi relatif yang arahnya dikenali ("tambah satu kamar mandi", P16-12): angkanya dari teks,
  // arahnya dari contoh — model tidak menambah apa pun selain 10–100 detik.
  const mutationOp = input.understanding?.mutationOp ?? null;
  // Permintaan rekomendasi tanpa satu pun hal kebutuhan ("mending pvc apa hdpe?"): tidak ada yang
  // bisa diekstrak — langsung nasihat bahan + kartu klarifikasi, bukan 100 detik model dulu.
  const adviceOnly =
    input.understanding?.intent?.label === 'advice_request' &&
    !input.understanding.mentionsRequirement;
  const skipModel = quickCore >= 2 || mutationOp !== null || adviceOnly;
  try {
    if (!ai) throw new AiOutputInvalidError('extraction', 'AI tidak tersedia');
    extraction = skipModel ? {} : await ai.extract(input.message);
  } catch (error) {
    // Model tidak terjangkau atau kehabisan waktu (produksi 2026-10-07: pesan masjid 2 lantai yang
    // panjang → 7B lewat 180 s → "Pemahaman bahasa sedang tidak tersedia") diperlakukan sama
    // dengan keluaran tidak valid: fakta tersurat di teks tetap dicatat, giliran tidak jatuh.
    if (!(error instanceof AiOutputInvalidError) && !(error instanceof LlmUnavailableError)) {
      throw error;
    }
    extractionFailed = true;
  }

  let merged: RequirementState;
  let changed: boolean;
  {
    // Pesan pembuka tanpa satu pun fakta ("mau nanya2 dong", "boleh tanya?"): model kecil kerap
    // memberinya label REQUIREMENT_STATEMENT, dan formulir klarifikasi adalah jawaban yang salah
    // untuk orang yang baru hendak bertanya. Ekstraksi kosong berarti tidak ada yang bisa
    // diklarifikasi dari pesan ini — dijawab seperti percakapan. Hanya untuk pernyataan pertama:
    // jawaban klarifikasi dan mutasi yang kosong tetap lewat jalur biasa.
    // Kosong dinilai SETELAH fakta tersurat dari teks ikut dihitung (`extractionToUpdates`):
    // "rumah 2 lantai, tidak ada dapur" dengan model yang mengembalikan {} bukan pembuka
    // (produksi 2026-10-07 — sempat dijawab "silakan tanyakan saja").
    // "tambah satu kamar mandi" atas 3 kamar mandi = 4, bukan 1 (P16-12): jumlah dihitung relatif
    // terhadap state bila arah mutasinya dikenali; field lain tetap absolut.
    const updates = applyRelativeCounts(
      extractionToUpdates(extraction, input.message),
      input.message,
      input.state,
      mutationOp,
    );
    if (extractionFailed && updates.length === 0) {
      // Model gagal dan teksnya tidak memuat fakta yang bisa dibaca kode: tanya yang kurang.
      events.push({ type: 'stage', stage: 'UNDERSTANDING', status: 'failed' });
      const plan = planClarification(
        withCompleteness(input.state).missingInformation,
        input.locale,
      );
      if (plan)
        events.push({ type: 'card', card: { kind: 'clarification', questions: plan.questions } });
      events.push(endEvent(input.messageId));
      return { events, nextState: input.state, changed: false, trigger: 'extraction' };
    }

    if (
      input.decision.intent === 'REQUIREMENT_STATEMENT' &&
      isEmptyExtraction(extraction) &&
      updates.length === 0 &&
      // "mending pvc apa hdpe?" bukan pembuka: nasihat bahannya ditulis di bawah.
      !adviceOnly
    ) {
      events.push({ type: 'stage', stage: 'UNDERSTANDING', status: 'done', detail: '0 DATA' });
      const written =
        reply && loadEnv().LLM_CHAT_REPLY
          ? await reply.write({
              intent: 'OUT_OF_SCOPE',
              userMessage: input.message,
              recentTurns: input.recentTurns ?? [],
              ...(input.locale ? { locale: input.locale } : {}),
              fallback: openerReply(input.locale),
            })
          : { text: openerReply(input.locale) };
      events.push({ type: 'token', text: written.text });
      events.push(endEvent(input.messageId));
      return { events, nextState: input.state, changed: false, trigger: 'extraction' };
    }

    const result = mergeRequirement(input.state, updates, input.now);
    merged = withCompleteness(result.state);
    changed = result.changed.length > 0;
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
  // "harga pipa buat rumah 2 lantai berapa?": kebutuhannya dicatat, tetapi pertanyaan harganya
  // tetap dijawab (kebijakan OQ-03) — bukan dibiarkan menguap di balik kartu (audit live 2026-10-08).
  if (input.understanding?.intent?.label === 'price_question') {
    events.push({ type: 'token', text: productAnswerCopy(locale).priceNotShown });
    events.push({ type: 'card', card: { kind: 'cta', action: 'CONTACT_TECHNICAL' } });
  }

  const materials =
    input.understanding?.intent?.label === 'advice_request'
      ? materialsFor(input.understanding.families)
      : [];
  if (materials.length > 0) {
    events.push({
      type: 'token',
      text: adviseMaterials(
        materials,
        {
          buildingLabel: buildingLabel(merged.building.type.value),
          floors: merged.building.floors.value,
          needsMoreData: merged.missingInformation.length > 0,
        },
        locale,
      ),
    });
  }

  const card = followUpCard(merged, input.locale);
  // Giliran kebutuhan bangunan tidak pernah bisu (checkpoint Fase 15, S1/S11): satu kalimat
  // tentang apa yang tercatat, lalu kartunya. Jalur irigasi/teknis/kebijakan sudah menulis
  // teksnya sendiri; bahan yang dinasihati di atas pun sudah.
  const policyCardShown = card?.kind === 'unsupported' || card?.kind === 'criteria';
  if (materials.length === 0 && merged.useCase === undefined && !policyCardShown) {
    const text = understoodReply(merged, card?.kind ?? null, locale);
    if (text !== null) events.push({ type: 'token', text });
  }
  if (card) events.push({ type: 'card', card });

  events.push(endEvent(input.messageId));

  const trigger: SnapshotTrigger = input.decision.mutatesState ? 'user_edit' : 'extraction';
  return { events, nextState: merged, changed, trigger };
}

/**
 * "Oke, rumah 2 lantai, 3 kamar mandi, toren atap, air bersih." + apa yang terjadi berikutnya:
 * lengkap → ajakan menyusun rekomendasi; belum → pengantar kartu klarifikasi. Tanpa model.
 */
export function understoodReply(
  state: RequirementState,
  nextCard: AssistantCard['kind'] | null,
  locale: Locale,
): string | null {
  // Kalimat, bukan tabel: jumlah fixture membawa NAMA field-nya ("3 kamar mandi", bukan "3 titik"
  // seperti di panel yang sudah berlabel); lantai dan nilai bernama memakai label nilainya.
  const en = locale === 'en';
  const captured: string[] = [];
  for (const [path, field] of fieldEntries(state)) {
    if (field.value === null || path === 'building.floorHeightM' || path === 'building.dimensions')
      continue;
    if (path.startsWith('fixtures.') && typeof field.value === 'number') {
      if (field.value === 0) continue;
      const label = requirementFieldLabel(path, locale).toLowerCase();
      captured.push(
        en && field.value === 1 ? `1 ${label.replace(/s$/, '')}` : `${field.value} ${label}`,
      );
      continue;
    }
    if (typeof field.value === 'boolean') continue;
    captured.push(requirementValueLabel(path, field.value, locale).toLowerCase());
  }
  if (captured.length === 0) return null;
  const summary = captured.join(', ');
  if (nextCard === 'cta') {
    return locale === 'en'
      ? `Okay, I have noted: ${summary}. That is enough to size it — press **Compose recommendation** to see the pipe sizes and the product list.`
      : `Oke, sudah saya catat: ${summary}. Datanya cukup untuk dihitung — tekan **Susun rekomendasi** untuk melihat ukuran pipa dan daftar produknya.`;
  }
  return locale === 'en'
    ? `Okay, I have noted: ${summary}. A few more things so the sizing is right:`
    : `Oke, sudah saya catat: ${summary}. Beberapa hal lagi supaya hitungannya pas:`;
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
export function followUpCard(
  merged: RequirementState,
  locale: Locale = DEFAULT_LOCALE,
): AssistantCard | null {
  if (merged.useCase?.kind === 'irrigation') return irrigationFollowUp(merged, locale);
  if (merged.useCase?.kind === 'technical') return technicalFollowUp(merged, locale);
  const scope = scopePolicy(
    {
      buildingType: merged.building.type.value,
      installationType: merged.water.installationType.value,
      floors: merged.building.floors.value,
    },
    locale,
  );
  if (scope.kind === 'policy') return policyCard(scope, capturedFrom(merged, locale), locale);
  if (merged.missingInformation.length > 0) {
    const plan = planClarification(merged.missingInformation, locale);
    return plan ? { kind: 'clarification', questions: plan.questions } : null;
  }
  return { kind: 'cta', action: 'ANALYZE' };
}

/**
 * Irigasi: masih ada yang kurang → kartu pertanyaan irigasi; lengkap → CTA "Susun
 * rekomendasi" — mesin irigasi (Kelompok E) menghitungnya, semua bertanda asumsi sampai
 * divalidasi (OQ-47). Handoff ke tim teknis tetap tersedia dari layar solusi.
 */
function irrigationFollowUp(state: RequirementState, locale: Locale): AssistantCard | null {
  if (!isIrrigationComplete(state)) {
    const questions = planIrrigationClarification(state, locale);
    return questions.length > 0 ? { kind: 'clarification', questions } : null;
  }
  return { kind: 'cta', action: 'ANALYZE' };
}

/**
 * Kasus teknis: masih ada parameter kritis kosong → kartu pertanyaan berpilihan (angka ditanya
 * di teks); lengkap → validasi teknis terstruktur sampai kalkulator kasusnya tersedia.
 */
function technicalFollowUp(state: RequirementState, locale: Locale): AssistantCard | null {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return null;
  if (!isTechnicalComplete(state)) {
    const { card } = planTechnicalClarification(state, locale);
    return card.length > 0 ? { kind: 'clarification', questions: card } : null;
  }
  const profile = caseProfile(state.useCase.caseId);
  if (profile.calculatorStatus === 'available') return { kind: 'cta', action: 'ANALYZE' };
  return policyCard(
    technicalHandoffPolicy(caseProfileLabel(state.useCase.caseId, locale), locale),
    capturedFrom(state, locale),
    locale,
  );
}

/**
 * Kebutuhan yang sudah terkumpul, untuk dibawa ke kartu validasi teknis dan antrean tim
 * teknis — supaya pengguna tidak mengulang ceritanya dari nol. Bahasa pengguna, bukan path.
 */
export function capturedFrom(
  state: RequirementState,
  locale: Locale = DEFAULT_LOCALE,
): readonly KeyValue[] {
  const rows: KeyValue[] = [];
  for (const [path, field] of fieldEntries(state)) {
    if (field.value !== null) {
      rows.push({
        label: requirementFieldLabel(path, locale),
        value: requirementValueLabel(path, field.value, locale),
      });
    }
  }
  return [...rows, ...irrigationCaptured(state, locale), ...technicalCaptured(state, locale)];
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
export function assumptionCardFor(state: RequirementState, locale: Locale = DEFAULT_LOCALE) {
  return assumptionCard(fieldEntries(state), locale);
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
