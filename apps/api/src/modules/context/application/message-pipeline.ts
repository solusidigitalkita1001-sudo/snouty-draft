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
  Dimensions,
  KeyValue,
  RequirementFieldPath,
  RequirementState,
  SnapshotTrigger,
} from '@snouty/shared-types';
import { AiOutputInvalidError, LlmUnavailableError } from '../../ai/domain/ai.errors.js';
import type { AiService } from '../../ai/domain/ai.port.js';
import type { Extraction } from '../../ai/domain/extraction-schema.js';
import { CORE_REQUIREMENT_FIELDS, DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import { loadEnv } from '../../../config/env.js';
import { streamedEvents, type EventSink } from '../../../shared/sse/event-stream.js';
import {
  activeParameters,
  caseInputIssues,
  caseProfile,
  caseProfileLabel,
  extractTechnicalContext,
  isCaseId,
  type CaseId,
} from '@snouty/engineering';
import { policyCard } from '../../policy/policy-cards.js';
import {
  exceedsAutomaticFloors,
  scopePolicy,
  technicalHandoffPolicy,
  useCasePolicy,
} from '../../policy/scope.js';
import {
  applyTechnicalFacts,
  carryBuildingFloors,
  detectTechnicalCase,
  technicalNudge,
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
  planIrrigationClarification,
} from '../domain/irrigation.js';
import { irrigationGuidance } from './irrigation-guidance.js';
import { assumptionCard, houseAssumptionUpdates } from '../domain/requirement-defaults.js';
import { houseRefinementQuestions, planClarification } from '../domain/clarification.js';
import { outlierQuestions, pendingOutliers } from '../domain/plausibility.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { isSocial } from '../../understanding/domain/labels.js';
import { repeatedTopicReply } from './reply-copy.js';
import { withCompleteness } from '../domain/completeness.js';
import { fieldEntries } from '../domain/requirement-field.js';
import { requirementFieldLabel, requirementValueLabel } from '../domain/requirement-labels.js';
import type { MessageUnderstanding } from '../../understanding/application/message-understanding.js';
import { applyRelativeCounts } from '../domain/relative-counts.js';
import { parseTemperature } from '../domain/temperature-parser.js';
import { extractionToUpdates } from './extraction-to-updates.js';
import type { RoutingDecision } from './intent-router.js';
import { adviseMaterials, materialsFor } from './pipe-knowledge.js';
import { productAnswerCopy } from './product-answer-text.js';
import { competitorAnswer } from './competitor-answer.js';
import {
  explanationBeforeSolution,
  requirementUnchangedReply,
  explanationHandedOff,
  modelBusyReply,
  openerReply,
  capabilityReply,
  outOfTopicReply,
  replyFor,
} from './reply-copy.js';
import { caseFacts } from './case-facts.js';
import { layoutReply, solutionReply } from './solution-facts.js';
import type { ReplyTurn, ReplyWriter } from './reply-writer.js';
import type { ActiveSolution } from '../domain/active-solution.port.js';

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
  /** Rekomendasi yang sudah dihitung (P22-04) — fakta untuk pertanyaan tentang solusinya. */
  readonly solution?: ActiveSolution | null;
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

  // Policy 1 DULU, sebelum apa pun: pertanyaan kompetitor tidak pernah masuk jalur rekomendasi.
  // Memeriksanya di sini — bukan setelah ekstraksi — berarti tidak ada jalan ia tercampur dengan
  // pencocokan produk. Isinya keputusan pemilik 2026-10-12 (b): merek lain tidak dinilai, keunggulan
  // Pralon dari profil terverifikasi, lalu tawaran tim teknis.
  if (input.decision.intent === 'COMPETITOR_QUESTION') {
    events.push({
      type: 'token',
      text: competitorAnswer(locale, input.understanding?.knowledgeTopics ?? []),
    });
    events.push({ type: 'card', card: { kind: 'cta', action: 'CONTACT_TECHNICAL' } });
    events.push(endEvent(input.messageId));
    return { events, nextState: input.state, changed: false, trigger: 'extraction' };
  }

  if (!input.decision.shouldExtract) {
    // Sapaan/di luar topik, minta penjelasan, atau model ragu: bukan ruas ekstraksi,
    // tetapi tetap dijawab — giliran yang ditutup tanpa sepatah kata terbaca sebagai
    // kerusakan. (Lookup produk punya ruasnya sendiri sebelum sampai ke sini.)
    const label = input.understanding?.intent?.label;
    const caseCard = followUpCard(withCompleteness(input.state), input.locale);
    const handedOff = caseCard?.kind === 'unsupported';
    // Bentuk sistem pengguna sendiri (P22-02): teks tetap dari jalur dan BOQ solusinya, gambar menyusul.
    const drawing = drawingCardFor(label, input.solution);
    // Pertanyaan atas solusi yang SUDAH dihitung dijawab dari solusinya sendiri, bukan ditulis
    // ulang model: di produksi 2026-10-26 "fitting apa aja yang perlu dibeli" memakan 55,7 detik,
    // "berapa batang pipanya" 42,6 detik, dan "kenapa ukurannya 1 inci" 48,1 detik — dan ketiga
    // jawabannya kabur serta saling bertentangan soal ukuran, padahal daftar belanja dan jalurnya
    // sudah berisi angka yang pasti.
    const fromSolution =
      (drawing !== null && !!input.solution) ||
      (input.decision.intent === 'EXPLANATION_REQUEST' &&
        !!input.solution &&
        !input.solution.stale);
    const fallback =
      drawing !== null && input.solution
        ? layoutReply(input.solution, input.locale ?? DEFAULT_LOCALE)
        : // Penjelasan atas solusi yang sudah dihitung (P22-04): teks tetap dari solusinya sendiri.
          input.decision.intent === 'EXPLANATION_REQUEST' && input.solution && !input.solution.stale
          ? solutionReply(input.solution, input.locale ?? DEFAULT_LOCALE)
          : label === 'capability_question'
            ? capabilityReply(input.locale)
            : label === 'out_of_scope'
              ? outOfTopicReply(input.locale)
              : input.decision.intent === 'EXPLANATION_REQUEST' && handedOff
                ? // "Mana perhitungannya?" atas kasus yang diserahkan ke tim teknis: tidak ada solusi untuk
                  // dibuka — katakan alasannya (laporan pemilik 2026-10-09).
                  explanationHandedOff(caseCard.reasons, input.locale)
                : input.decision.intent === 'EXPLANATION_REQUEST' &&
                    (!input.solution || input.solution.stale)
                  ? // Belum ada solusi yang bisa dibuka detailnya — baik karena kebutuhannya belum
                    // lengkap, maupun karena tombol hitungnya belum ditekan. Lewat model giliran ini
                    // 27 detik dan jawabannya mengaku mencatat hal yang tidak punya tempat di
                    // kebutuhan ("sudah saya catat bahwa air kotor dan air bekas dipisahkan",
                    // produksi 2026-10-26).
                    explanationBeforeSolution(input.locale)
                  : input.decision.intent === 'OUT_OF_SCOPE' &&
                      (input.recentTurns ?? []).some((turn) => turn.role === 'assistant')
                    ? // Perkenalan hanya untuk giliran pertama. Sapaan ulang dijawab ajakan bertanya;
                      // pesan lain yang di luar topik ("enaknya makan apa?") dijawab di luar topik —
                      // dulu keduanya mendapat ajakan bertanya (laporan pemilik 2026-10-09).
                      label === 'greeting'
                      ? greetingAgain(input.recentTurns ?? [], input.locale)
                      : outOfTopicReply(input.locale)
                    : input.decision.modelUnavailable === true
                      ? // Giliran yang kehabisan waktu, bukan pertanyaan yang tidak terbaca (P28-02).
                        modelBusyReply(input.locale)
                      : replyFor(input.decision.intent, input.locale);
    if (fallback !== null) {
      // Model merangkai balasan di atas DATA kasus (P16-28): yang sudah dicatat, status kasus, dan
      // cara SNOUTY menghitung — semuanya dari kode. Angka di luar DATA ditolak `ReplyWriter`, jadi
      // "kenapa 1 inci?" tidak bisa dijawab dengan alasan karangan. Model gagal/lambat → teks tetap.
      // Salam pertama sudah pas sebagai teks tetap — tidak perlu menunggu model.
      const firstGreeting =
        label === 'greeting' && !(input.recentTurns ?? []).some((t) => t.role === 'assistant');
      // Jawaban tetap yang sudah pas tidak perlu ditulis ulang model: "kamu bisa apa aja?" memakan
      // 24,8 detik di produksi 2026-10-26, dan di tengah percakapan produk model malah mengulang
      // persis jawaban giliran sebelumnya.
      const fixedIsEnough =
        firstGreeting ||
        fromSolution ||
        // Sapaan ulang dan basa-basi juga: teksnya sudah pas, dan model di CPU memakai 14 detik
        // untuk menggantinya dengan kalimat yang lebih buruk (produksi 2026-10-26).
        label === 'greeting' ||
        isSocial(label) ||
        fallback === capabilityReply(input.locale) ||
        // "Ukurannya baru dihitung setelah Anda menekan Susun rekomendasi" sudah menjawab
        // pertanyaan ukuran atas kebutuhan yang belum lengkap; lewat model ia 49,6 detik dan
        // balik menanyakan sumber air yang baru saja disebut pengguna (produksi 2026-10-26).
        fallback === explanationBeforeSolution(input.locale) ||
        fallback === outOfTopicReply(input.locale);
      const written =
        reply && loadEnv().LLM_CHAT_REPLY && !fixedIsEnough
          ? await reply.write({
              intent: input.decision.intent,
              userMessage: input.message,
              recentTurns: input.recentTurns ?? [],
              facts:
                caseFacts(
                  withCompleteness(input.state),
                  input.locale ?? DEFAULT_LOCALE,
                  caseCard,
                  input.solution ?? null,
                ) +
                (drawing !== null
                  ? input.locale === 'en'
                    ? '\n- The installation section drawing is shown right below this reply; describe the runs and materials, do not say a drawing is unavailable.'
                    : '\n- Gambar potongan instalasi tampil tepat di bawah jawaban ini; jelaskan jalur dan materialnya, jangan katakan gambar tidak tersedia.'
                  : ''),
              ...(input.locale ? { locale: input.locale } : {}),
              fallback,
            })
          : { text: fallback };
      // Dua pertanyaan berbeda yang jatuh ke teks yang sama ("fitting apa aja" lalu "berapa
      // batang pipanya" → potongan instalasi yang sama persis) tidak dikirim ulang kata demi kata.
      const previous = [...(input.recentTurns ?? [])]
        .reverse()
        .find((t) => t.role === 'assistant')?.text;
      const repeated =
        previous !== undefined && previous.trim() !== '' && previous.trim() === written.text.trim();
      events.push({
        type: 'token',
        text: repeated ? repeatedTopicReply(input.locale) : written.text,
      });
    }
    if (drawing !== null) events.push({ type: 'card', card: drawing });
    events.push(endEvent(input.messageId));
    return { events, nextState: input.state, changed: false, trigger: 'extraction' };
  }

  // Jalur IRIGASI (OQ-47): alur yang sama seperti rumah — fakta tersurat dicatat, arahan
  // diberikan, yang kurang ditanya lewat kartu — tetapi muaranya handoff terstruktur, bukan
  // sizing otomatis. Nol LLM: pertanyaannya tertutup, faktanya dari bentuk kalimat.
  // Irigasi dikenali dari pemahaman (katalog `use-case`/intent, P16-14), bukan daftar kata.
  // Kasus teknis yang SEDANG BERJALAN tidak diambil alih oleh isyarat irigasi: "pompanya apa" di
  // tengah kasus sumur bor dikenali `useCase: irrigation` (pompa memang sering irigasi), dan
  // jawabannya jadi penjelasan irigasi yang bicara soal lahan — padahal yang dibahas sumur
  // (produksi 2026-10-26). Hanya kebutuhan irigasi yang TERSURAT boleh berganti jalur.
  const statesIrrigation = input.understanding?.intent?.label === 'requirement_irrigation';
  const running = input.state.useCase?.kind;
  const irrigation =
    statesIrrigation || (input.understanding?.useCase === 'irrigation' && running !== 'technical');
  if (irrigation || running === 'irrigation') {
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
  const useCase = useCasePolicy(
    {
      outOfScopeFluid: input.understanding?.mentionsOutOfScopeFluid ?? false,
      temperatureC: parseTemperature(input.message),
    },
    locale,
  );
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
  // Jenis kasus dari katalog `use-case` (P16-14): "kos 3 lantai, 12 kamar mandi, air dari sumur" adalah
  // kebutuhan bangunan; "sumur bor 60 m ke tandon" adalah kasus distribusi sumur; "gedung 8 lantai"
  // kasus gedung bertingkat — dibedakan dari contoh, bukan dari bobot kata.
  const detected = detectTechnicalCase(input.understanding?.useCase ?? null, input.state);
  const technicalCase =
    (lowRiseHint(detected, input.state, input.message) ? null : detected) ??
    tallBuildingCase(input.state, input.message);
  if (technicalCase !== null) {
    const facts = applyTechnicalFacts(input.state, technicalCase, input.message);
    const applied = { ...facts, state: carryBuildingFloors(facts.state, technicalCase) };
    events.push({ type: 'requirement.updated', state: applied.state });
    // Kalimat pembuka kasus hanya di giliran pertama; giliran berikutnya langsung data + pertanyaan.
    const firstTurn = input.state.useCase?.kind !== 'technical';
    const card = technicalFollowUp(applied.state, locale);
    const questions = technicalQuestionCard(applied.state, locale);
    // Data yang saling bertentangan ditanyakan balik lebih dulu — sebelum panduan dan tombol hitung.
    const issues = technicalInputIssues(applied.state, locale);
    const guidance =
      issues.length > 0
        ? issues.join(' ')
        : technicalGuidance(applied.state, locale, { withIntro: firstTurn });
    // Pesan lanjutan tanpa data baru ("lu belum nanya kamar mandi", "kasih gw pilihan") dijawab
    // sesuai isinya di atas DATA kasus — bukan template yang sama diulang (laporan pemilik
    // 2026-10-09). Model gagal → teks panduan seperti biasa.
    // Yang dihitung "data baru" hanya parameter kasus ini: "kenapa harus pakai pompa transfer?"
    // menyebut pompa, tetapi kasus gedung tidak menanyakannya — itu pertanyaan, bukan jawaban.
    const caseParameters = activeParameters(caseProfile(technicalCase));
    const chatOnly = !firstTurn && !facts.captured.some((key) => caseParameters.includes(key));
    // Model hanya untuk pertanyaan yang butuh penjelasan; dorongan/protes/minta pilihan dijawab
    // langsung dari daftar parameter kasus — instan, tanpa model (benchmark P16-40).
    const explains = EXPLAINING_INTENTS.has(input.understanding?.intent?.label ?? '');
    const text =
      !chatOnly || issues.length > 0
        ? guidance
        : !explains
          ? technicalNudge(
              applied.state,
              locale,
              input.understanding?.intent?.label === 'follow_up_more',
            )
          : reply && loadEnv().LLM_CHAT_REPLY
            ? (
                await reply.write({
                  intent: input.decision.intent,
                  userMessage: input.message,
                  recentTurns: input.recentTurns ?? [],
                  facts: caseFacts(applied.state, locale, card, input.solution ?? null),
                  locale,
                  fallback: guidance,
                })
              ).text
            : guidance;
    events.push({ type: 'token', text });
    if (questions) events.push({ type: 'card', card: questions });
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
  // Rumah tinggal: setiap data yang dipakai hitungan rumah dibaca parser nilai (jumlah dengan digit
  // atau kata bilangan, sumber, pompa, panjang jalur, sumur, renovasi), dan yang tidak disebut
  // dianggap atau ditanya kartu. Model hanya menambah 15–50 detik (uji sales 2026-10-20; pemilik
  // 2026-10-21 memilih melewati model untuk semua pesan rumah).
  // Rumah yang SUDAH tercatat ikut: keputusan itu tentang kasusnya, bukan tentang satu kalimat.
  // Dulu gerbang ini hanya membaca pesannya sendiri, jadi "rumah gw 2 lantai" melewati model
  // tetapi "kamar mandi 3" sesudahnya tidak — 90 detik untuk satu angka yang sudah dibaca parser
  // nilai, di percakapan yang sudah jelas rumah tinggal (produksi 2026-10-26).
  const house =
    input.state.building.type.value === 'residential' ||
    extractionToUpdates({}, input.message).some(
      (u) => u.path === 'building.type' && u.value === 'residential',
    );
  // Kasus yang diserahkan ke tim teknis tidak dihitung di sini, jadi tebakan model atas kalimat
  // lanjutannya tidak mengubah satu angka pun — hanya menambah belasan detik.
  const handedOff =
    followUpCard(withCompleteness(input.state), input.locale)?.kind === 'unsupported';
  const skipModel = quickCore >= 2 || house || mutationOp !== null || adviceOnly || handedOff;
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
  let changedPaths: readonly RequirementFieldPath[];
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
      !adviceOnly &&
      // Hanya pesan PEMBUKA. Dengan kebutuhan yang sudah tercatat, "oke lanjut" dan "ada yang
      // lebih murah ga" bukan orang yang baru hendak bertanya — lewat sini keduanya ditulis model
      // di CPU (14 dan 18 detik) dan berbunyi seperti bot (produksi 2026-10-26); jalur biasa di
      // bawah menjawabnya dari DATA kasus.
      capturedFrom(input.state).length === 0
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
    changedPaths = result.changed;
    // Rumah yang lantainya sudah disebut: sisa data inti dianggap dulu, lalu langsung dihitung.
    const assumptions = houseAssumptionUpdates(merged);
    if (assumptions.length > 0) {
      merged = withCompleteness(mergeRequirement(merged, assumptions, input.now).state);
      changed = true;
    }
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
    events.push({ type: 'card', card: { kind: 'cta', action: 'CONTACT_SALES' } });
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

  const next = followUpCard(merged, input.locale);
  // "udah, itung aja" dijawab "Tekan **Susun rekomendasi**" padahal pengguna baru saja memintanya
  // menghitung (produksi 2026-10-26). Permintaan melanjutkan atas kebutuhan yang sudah bisa
  // dihitung dijalankan di giliran ini, tanpa menunggu ada data yang berubah.
  const asksToCompute = input.understanding?.intent?.label === 'follow_up_continue';
  // Rumah yang baru lengkap di giliran ini langsung dihitung — dengan atau tanpa anggapan.
  const card: AssistantCard | null =
    next?.kind === 'cta' &&
    next.action === 'ANALYZE' &&
    (changed || asksToCompute) &&
    merged.useCase === undefined
      ? { ...next, auto: true }
      : next;
  // Giliran kebutuhan bangunan tidak pernah bisu (checkpoint Fase 15, S1/S11): satu kalimat
  // tentang apa yang tercatat, lalu kartunya. Jalur irigasi/teknis/kebijakan sudah menulis
  // teksnya sendiri; bahan yang dinasihati di atas pun sudah.
  // Kasus yang SUDAH diserahkan di giliran sebelumnya: kalimat besar penyerahannya tidak diulang
  // kata per kata, tetapi data baru tetap disebut balik supaya terlihat ikut ke tim teknis.
  const policyCardShown = (card?.kind === 'unsupported' && !handedOff) || card?.kind === 'criteria';
  // Kasus yang sudah diserahkan dan tidak berubah: kartu besar dan kalimatnya tidak diulang tiap
  // pesan — pesannya dijawab di atas DATA kasus di bawah (laporan pemilik 2026-10-09).
  const repeatedHandoff = card?.kind === 'unsupported' && !changed;
  if (
    card?.kind === 'unsupported' &&
    !repeatedHandoff &&
    !handedOff &&
    materials.length === 0 &&
    merged.useCase === undefined
  ) {
    events.push({
      type: 'token',
      text:
        locale === 'en'
          ? 'This one needs to be worked out by the Pralon technical team.'
          : 'Yang ini perlu dihitung oleh tim teknis Pralon.',
    });
  }
  if (materials.length === 0 && merged.useCase === undefined && !policyCardShown) {
    // Ubahan ("jadi 3 lantai") cukup menyebut yang berubah, bukan mengulang semua kebutuhan.
    const only = input.decision.mutatesState && changedPaths.length > 0 ? changedPaths : undefined;
    const auto = card?.kind === 'cta' && card.auto === true;
    const text = understoodReply(merged, card?.kind ?? null, locale, only, auto);
    // Ringkasan yang sama persis dua giliran berturut-turut: pesannya tidak mengubah kebutuhan,
    // jadi yang dikatakan adalah itu — bukan daftar yang sama diulang kata demi kata.
    const said = [...(input.recentTurns ?? [])].reverse().find((t) => t.role === 'assistant')?.text;
    const same = text !== null && said !== undefined && said.trim() === text.trim();
    if (text !== null) {
      events.push({ type: 'token', text: same ? requirementUnchangedReply(locale) : text });
    }
  }
  // Giliran yang tidak menghasilkan kalimat apa pun ("itung ulang, luasnya belum gw kasih" atas
  // kasus yang tidak berubah) dulu tampil sebagai "Saya belum bisa membaca pesan itu" di web
  // (laporan pemilik 2026-10-09). Sekarang dijawab di atas DATA kasus; model gagal → teks tetap.
  if (!events.some((e) => e.type === 'token')) {
    const fallback = requirementUnchangedReply(locale);
    // Model hanya untuk maksud yang memang butuh penjelasan — sama seperti jalur kasus teknis
    // (P16-40). Dorongan dan pilihan ("oke lanjut", "ada yang lebih murah ga") dijawab teks tetap:
    // lewat model keduanya 14 dan 18 detik di CPU, dan yang keluar berbunyi seperti bot ("Saya
    // paham keinginan Anda mencari harga lebih hemat…", produksi 2026-10-26).
    const explains = EXPLAINING_INTENTS.has(input.understanding?.intent?.label ?? '');
    const written =
      reply && loadEnv().LLM_CHAT_REPLY && explains
        ? await reply.write({
            intent: input.decision.intent,
            userMessage: input.message,
            recentTurns: input.recentTurns ?? [],
            facts: caseFacts(merged, locale, card, input.solution ?? null),
            locale,
            fallback,
          })
        : { text: fallback };
    events.push({ type: 'token', text: written.text });
  }
  const refinement = card?.kind === 'cta' ? technicalQuestionCard(merged, locale) : null;
  if (refinement) events.push({ type: 'card', card: refinement });
  if (card && !repeatedHandoff) events.push({ type: 'card', card });

  events.push(endEvent(input.messageId));

  const trigger: SnapshotTrigger = input.decision.mutatesState ? 'user_edit' : 'extraction';
  return { events, nextState: merged, changed, trigger };
}

/**
 * Sapaan di tengah percakapan: ajakan bertanya, atau — bila ajakan itu baru saja dikirim —
 * kalimat pendek, supaya tidak ada balasan tetap yang terulang persis dua kali berturut-turut.
 */
function greetingAgain(recentTurns: readonly ReplyTurn[], locale: Locale | undefined): string {
  const opener = openerReply(locale);
  const lastAssistant = [...recentTurns].reverse().find((turn) => turn.role === 'assistant');
  if (lastAssistant?.text.trim() !== opener) return opener;
  return locale === 'en'
    ? "I'm here — go ahead with your question."
    : 'Saya di sini — silakan langsung tulis pertanyaannya.';
}

/**
 * "Oke, rumah 2 lantai, 3 kamar mandi, toren atap, air bersih." + apa yang terjadi berikutnya:
 * lengkap → ajakan menyusun rekomendasi; belum → pengantar kartu klarifikasi. Tanpa model.
 */
export function understoodReply(
  state: RequirementState,
  nextCard: AssistantCard['kind'] | null,
  locale: Locale,
  only?: readonly RequirementFieldPath[],
  /** Kartu ANALYZE langsung dijalankan (rumah dihitung di giliran ini). */
  auto = false,
): string | null {
  // Kalimat, bukan tabel: jumlah fixture membawa NAMA field-nya ("3 kamar mandi", bukan "3 titik"
  // seperti di panel yang sudah berlabel); lantai dan nilai bernama memakai label nilainya.
  const en = locale === 'en';
  const captured: string[] = [];
  // Yang dianggap tidak disebut sebagai "sudah saya catat": ditulis sendiri sebagai anggapan.
  const assumed: string[] = [];
  for (const [path, field] of fieldEntries(state)) {
    if (field.value === null || path === 'building.floorHeightM') continue;
    if (path === 'building.dimensions') {
      // Ukuran bangunan ikut disebut balik: ia yang menentukan panjang pipa, jadi "rumahnya 10 x 12
      // meter" yang tidak pernah muncul di "sudah saya catat" membuat pengguna menyebutnya lagi —
      // padahal angkanya sudah dipakai (produksi 2026-10-26). Ukuran TANAH juga, supaya jelas ia
      // tercatat walau tidak dipakai menghitung pipa.
      const d = field.value as {
        mainRunMeters?: number;
        lengthM?: number;
        widthM?: number;
        areaM2?: number;
        landLengthM?: number;
        landWidthM?: number;
        landAreaM2?: number;
      };
      if (field.provenance !== 'ASSUMED' && (!only || only.includes(path))) {
        const m = (v: number) =>
          v.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });
        if (typeof d.mainRunMeters === 'number') {
          captured.push(
            en
              ? `a main run of about ${m(d.mainRunMeters)} m`
              : `jalur utama ±${m(d.mainRunMeters)} m`,
          );
        }
        if (typeof d.lengthM === 'number' && typeof d.widthM === 'number') {
          captured.push(
            en
              ? `a ${m(d.lengthM)} × ${m(d.widthM)} m footprint`
              : `bangunan ${m(d.lengthM)} × ${m(d.widthM)} m`,
          );
        } else if (typeof d.areaM2 === 'number') {
          captured.push(
            en ? `a floor area of ${m(d.areaM2)} m²` : `luas bangunan ${m(d.areaM2)} m²`,
          );
        }
        if (typeof d.landLengthM === 'number' && typeof d.landWidthM === 'number') {
          captured.push(
            en
              ? `land ${m(d.landLengthM)} × ${m(d.landWidthM)} m`
              : `tanah ${m(d.landLengthM)} × ${m(d.landWidthM)} m`,
          );
        } else if (typeof d.landAreaM2 === 'number') {
          captured.push(en ? `land of ${m(d.landAreaM2)} m²` : `tanah ${m(d.landAreaM2)} m²`);
        }
      }
      continue;
    }
    if (field.provenance === 'ASSUMED' && field.source === 'default_applied') {
      const phrase = assumedPhrase(path, field.value, locale);
      if (phrase !== null) assumed.push(phrase);
      continue;
    }
    if (only && !only.includes(path)) continue;
    if (path.startsWith('fixtures.') && typeof field.value === 'number') {
      if (field.value === 0) continue;
      const label = requirementFieldLabel(path, locale).toLowerCase();
      captured.push(
        en && field.value === 1 ? `1 ${label.replace(/s$/, '')}` : `${field.value} ${label}`,
      );
      continue;
    }
    // Angka meter tanpa nama terbaca janggal di kalimat ("…, dan 10 m") — review putaran 4, 6a.
    if (path === 'water.wellDepthM' && typeof field.value === 'number') {
      const m = field.value.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });
      captured.push(en ? `a well water level of about ${m} m` : `muka air sumur ±${m} m`);
      continue;
    }
    if (typeof field.value === 'boolean') continue;
    // Data pipa lama (P23-03) dibaca sebagai frasa, bukan nilai telanjang ("…, 3/4"").
    if (path === 'water.existingMainSize') {
      captured.push(en ? `an existing ${field.value} main pipe` : `pipa utama lama ${field.value}`);
      continue;
    }
    if (path === 'water.existingPipeMaterial') {
      const material = requirementValueLabel(path, field.value, locale);
      captured.push(en ? `the existing pipe is ${material}` : `pipa lamanya ${material}`);
      continue;
    }
    if (path === 'water.existingOutlets' && typeof field.value === 'number') {
      captured.push(
        en ? `${field.value} existing water points` : `${field.value} titik air yang sudah ada`,
      );
      continue;
    }
    if (path === 'water.addedOutlets' && typeof field.value === 'number') {
      captured.push(en ? `${field.value} added water points` : `tambah ${field.value} titik air`);
      continue;
    }
    if (path === 'water.replacementLengthM' && typeof field.value === 'number') {
      const m = field.value.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });
      captured.push(en ? `${m} m of pipe to replace` : `${m} m pipa yang diganti`);
      continue;
    }
    captured.push(inSentence(requirementValueLabel(path, field.value, locale)));
  }
  if (captured.length === 0) return null;
  const summary = joinList(captured, locale);
  const opener = only
    ? en
      ? `Okay, changed to ${summary}.`
      : `Oke, sudah saya ubah: ${summary}.`
    : en
      ? `Okay, I have noted: ${summary}.`
      : `Oke, sudah saya catat: ${summary}.`;
  // Kasus yang ditangani tim teknis: tidak ada hitungan yang ditunggu di sini, jadi data baru
  // ditutup dengan ke mana ia pergi — bukan "beberapa hal lagi supaya hitungannya pas".
  if (nextCard === 'unsupported') {
    return en
      ? `${opener} It goes to the Pralon technical team together with the case.`
      : `${opener} Angkanya ikut ke tim teknis Pralon bersama kasusnya.`;
  }
  if (nextCard === 'cta' && auto) {
    const guess =
      assumed.length === 0
        ? ''
        : en
          ? ` Until you tell me otherwise I am taking ${joinList(assumed, locale)}.`
          : ` Yang belum disebut saya anggap dulu ${joinList(assumed, locale)}.`;
    const change =
      assumed.length === 0
        ? ''
        : en
          ? ' If any of that is different, answer the questions below and I will recompute.'
          : ' Kalau ada yang berbeda, jawab pertanyaan di bawah dan hitungannya saya ulang.';
    return en
      ? `${opener}${guess} I am working out the pipe sizes and the product list now.${change}`
      : `${opener}${guess} Ukuran pipa dan daftar produknya saya hitung sekarang.${change}`;
  }
  if (nextCard === 'cta') {
    return en
      ? `${opener} Press **Compose recommendation** to see the pipe sizes and the product list.`
      : `${opener} Tekan **Susun rekomendasi** untuk melihat ukuran pipa dan daftar produknya.`;
  }
  if (nextCard === 'clarification' && pendingOutliers(state).length > 0) {
    return en
      ? `${opener} One thing to check first:`
      : `${opener} Ada yang perlu saya pastikan dulu:`;
  }
  return en
    ? `${opener} A few more things so the sizing is right:`
    : `${opener} Beberapa hal lagi supaya hitungannya pas:`;
}

/** Anggapan rumah sebagai frasa ("1 kamar mandi per lantai", "air dari toren atap"). */
function assumedPhrase(path: RequirementFieldPath, value: unknown, locale: Locale): string | null {
  const en = locale === 'en';
  switch (path) {
    case 'fixtures.bathrooms':
      return en
        ? `1 bathroom per floor (${String(value)} in total)`
        : `1 kamar mandi per lantai (${String(value)} kamar mandi)`;
    case 'water.source':
      return en
        ? 'water from a rooftop tank without a booster pump'
        : 'air dari toren atap tanpa pompa pendorong';
    case 'water.installationType':
      return en ? 'clean water only' : 'air bersih saja';
    default:
      return null;
  }
}

/**
 * Label nilai di tengah kalimat: huruf pertama kecil, singkatan tetap ("PDAM", bukan "pdam" —
 * review putaran 3, 3e).
 */
function inSentence(label: string): string {
  return /^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

/** "a, b, dan c" / "a dan b" — daftar dalam kalimat, bukan deretan koma. */
function joinList(items: readonly string[], locale: Locale): string {
  const and = locale === 'en' ? 'and' : 'dan';
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} ${and} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${and} ${items.at(-1)}`;
}

/**
 * Kartu lanjutan atas state yang SUDAH di-merge — dipakai setelah ekstraksi maupun setelah
 * jawaban klarifikasi, supaya keduanya bermuara di keputusan yang sama:
 *
 *   - Policy 5: scope diputuskan dari kebutuhan nyata, bukan dari kata-kata pesan. Industri
 *     tidak sampai ke CTA analisis; air bersih dan pembuangan rumah dihitung.
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
  // Angka janggal (luas per kamar mandi, tanah lebih kecil dari bangunan) ditanya balik dulu.
  const outliers = pendingOutliers(merged);
  if (outliers.length > 0) {
    return { kind: 'clarification', questions: outlierQuestions(outliers, locale) };
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
/**
 * Pertanyaan yang masih bisa memperbaiki hitungan, sebagai kartu pilihan, di samping tombol Susun
 * rekomendasi — kasus yang sudah bisa dihitung tetap menawarkan kamar mandi, wastafel, tinggi, dan
 * tekanan (laporan pemilik 2026-10-09: pertanyaan dengan pilihan tidak pernah tampil karena
 * kasusnya sudah "lengkap"). `null` bila kasus belum lengkap (kartu itu sudah jadi tindak lanjut)
 * atau tidak ada pertanyaan berpilihan.
 */
export function technicalQuestionCard(
  state: RequirementState,
  locale: Locale,
): AssistantCard | null {
  // Rumah: ukuran, dapur, wastafel yang belum disebut — di samping tombol Susun rekomendasi.
  if (state.useCase === undefined) {
    if (followUpCard(state, locale)?.kind !== 'cta') return null;
    // Data inti yang baru dianggap ditanya lebih dulu — jawabannya menimpa anggapan.
    const assumedCore = (['fixtures.bathrooms', 'water.source'] as const).filter(
      (path) =>
        (path === 'fixtures.bathrooms' ? state.fixtures.bathrooms : state.water.source).source ===
        'default_applied',
    );
    // Satu rencana per field: rencana gabungan dua field berbentuk satu pertanyaan saja.
    const confirm = assumedCore.flatMap(
      (path) => planClarification([path], locale)?.questions ?? [],
    );
    const refinements = houseRefinementQuestions(
      // Titik air tambahan yang disebut: beban lama = rumah yang disebut (P25-06), tidak ditanya lagi.
      (path) =>
        fieldValueKnown(state, path) ||
        (path === 'water.existingOutlets' && (state.water.addedOutlets?.value ?? null) !== null),
      locale,
      state.building.type.value,
      state.water.source.value,
      state.water.workType?.value ?? (state.water.replaceExisting?.value ? 'replace_all' : null),
    );
    const questions = [...confirm, ...refinements];
    return questions.length > 0 ? { kind: 'clarification', questions } : null;
  }
  if (state.useCase.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return null;
  if (!isTechnicalComplete(state)) return null;
  if (caseProfile(state.useCase.caseId).calculatorStatus !== 'available') return null;
  const { card } = planTechnicalClarification(state, locale);
  return card.length > 0 ? { kind: 'clarification', questions: card } : null;
}

/**
 * Nilai kasus yang saling bertentangan (tinggi per lantai, kepadatan penghuni, tekanan di atas
 * batas zona) sebagai kalimat tanya — dari pagar engine, bukan dari teks pesan.
 */
export function technicalInputIssues(state: RequirementState, locale: Locale): readonly string[] {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return [];
  const values = Object.fromEntries(
    Object.entries(state.useCase.parameters).map(([key, p]) => [key, p.value]),
  );
  return caseInputIssues(state.useCase.caseId, values, state.useCase.assumptionOverrides ?? {}).map(
    (issue) => (locale === 'en' ? issue.messageEn : issue.message),
  );
}

function technicalFollowUp(state: RequirementState, locale: Locale): AssistantCard | null {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return null;
  if (!isTechnicalComplete(state)) {
    const { card } = planTechnicalClarification(state, locale);
    return card.length > 0 ? { kind: 'clarification', questions: card } : null;
  }
  const profile = caseProfile(state.useCase.caseId);
  if (profile.calculatorStatus === 'available') {
    return technicalInputIssues(state, locale).length > 0
      ? null
      : { kind: 'cta', action: 'ANALYZE' };
  }
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
    case 'place_of_worship':
      return 'tempat ibadah';
    case 'public_building':
      return 'sekolah atau klinik';
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

/**
 * Gambar potongan instalasi untuk pertanyaan bentuk sistem pipa (P22-02): hanya bila solusinya
 * sudah dihitung dan masih berlaku — gambarnya dibentuk dari kebutuhan bergambar yang sama dengan
 * tab Denah, jadi tidak bisa bertentangan dengan angka di solusi.
 */
export function drawingCardFor(
  label: string | undefined,
  solution: ActiveSolution | null | undefined,
): AssistantCard | null {
  if (label !== 'system_layout_question' || !solution || solution.stale) return null;
  const needs = solution.recommendation.needs ?? [];
  return needs.length > 0 ? { kind: 'drawing', needs } : null;
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

/** Maksud yang butuh penjelasan model, bukan sekadar daftar yang masih ditanya. */
const EXPLAINING_INTENTS: ReadonlySet<string> = new Set([
  'product_concept',
  'product_comparison',
  'product_spec',
  'product_range',
  'price_question',
  'use_question',
  'knowledge_question',
  'advice_request',
  'explanation_request',
  'system_layout_question',
  'company_question',
  'competitor_question',
  'out_of_scope',
]);

/**
 * Gedung di atas batas hitung rumah (> 4 lantai) dihitung sebagai gedung bertingkat — tangki
 * bawah, pompa transfer, zona tekanan, riser — bukan dihentikan di kartu "perlu tim teknis"
 * (keputusan pemilik 2026-10-09). Jumlah lantai dari parser nilai atau dari kebutuhan tercatat.
 */
function statedFloors(state: RequirementState, message: string): number | null {
  const said = extractTechnicalContext(message, 'multistorey_building_water').find(
    (f) => f.key === 'building_floors',
  )?.value;
  return typeof said === 'number' ? said : state.building.floors.value;
}

function tallBuildingCase(state: RequirementState, message: string): CaseId | null {
  if (state.building.type.value === 'industrial') return null;
  const floors = statedFloors(state, message);
  return floors !== null && exceedsAutomaticFloors(floors) ? 'multistorey_building_water' : null;
}

/**
 * Kasus gedung bertingkat hanya berlaku DI ATAS batas hitung rumah (> 4 lantai, keputusan pemilik
 * 2026-10-09) — di bawahnya jalur bangunan biasa menghitungnya utuh. Katalog kasus kadang memberi
 * label gedung bertingkat untuk bangunan rendah: "i need pipes for a 3 storey office, 6 bathrooms
 * per floor" ditanya jumlah penghuni, luas per lantai, wastafel per lantai, dan tinggi bangunan —
 * tanpa tombol hitung — sedangkan kalimat Indonesia yang sama persis dihitung langsung (produksi
 * 2026-10-26). Kasus yang sudah BERJALAN tidak dibatalkan aturan ini.
 */
function lowRiseHint(useCase: CaseId | null, state: RequirementState, message: string): boolean {
  if (useCase !== 'multistorey_building_water') return false;
  if (state.useCase?.kind === 'technical' && state.useCase.caseId === useCase) return false;
  const floors = statedFloors(state, message);
  return floors !== null && !exceedsAutomaticFloors(floors);
}

/** Field kebutuhan rumah yang sudah disebut pengguna (nilai default/asumsi tidak dihitung). */
function fieldValueKnown(state: RequirementState, path: string): boolean {
  const [group, key] = path.split('.') as [string, string];
  const field = (
    state as unknown as Record<string, Record<string, { value: unknown; source?: string }>>
  )[group]?.[key];
  if (field === undefined || field.value === null || field.source === 'default_applied')
    return false;
  // Ukuran: yang dihitung adalah bangunan — ukuran tanah saja belum menjawab pertanyaannya.
  if (path === 'building.dimensions') {
    const d = field.value as Dimensions;
    return (d.lengthM !== undefined && d.widthM !== undefined) || d.areaM2 !== undefined;
  }
  return true;
}
