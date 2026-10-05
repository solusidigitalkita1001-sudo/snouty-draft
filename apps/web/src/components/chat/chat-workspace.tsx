'use client';

/**
 * Layar 02 — konsultasi aktif. Dari prototipe baru (sumber kebenaran #2).
 * docs/DESIGN_IMPLEMENTATION.md · docs/API_CONTRACTS.md §3.
 *
 * Metrik dari prototipe, lewat token: sidebar 236px, nav rail 60px, header 52px,
 * panel kanan 300px. Di bawah 1080px sidebar menciut dan panel jadi overlay.
 *
 * Yang dirender berasal dari event SSE sungguhan — `requirement.updated` mengisi
 * panel kanan, `card` memunculkan klarifikasi atau CTA, `stage` menggerakkan
 * indikator lima tahap, `error` memunculkan pesan jujur. Tidak ada timer palsu:
 * tahap bergerak saat batas pipeline benar-benar terlewati (SPEC §33b).
 */

import type {
  AnalysisStage,
  AssistantCard,
  AssistantStreamEvent,
  ClarificationQuestion,
  ProductCardDto,
  Recommendation,
  RequirementState,
  StageStatus,
} from '@snouty/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { moodForCards } from '../mascot/mood';
import { Snouty, SnoutyAvatar } from '../mascot/snouty';
import { ProductDrawer, type DrawerSelection } from '../product/product-drawer';
import { ReportModal } from '../report/report-modal';
import { REPORT_COPY } from '../report/report-copy';
import { ProductLookupCards } from './product-lookup-cards';
import {
  createConversation,
  fetchHistory,
  fetchRecommendation,
  runAnalysis,
  saveConversation,
  sendMessage,
  sendToTechnicalTeam,
  type ConversationSummary,
} from './chat-api';
import { SolutionView } from '../solution/solution-view';
import { restoreSession } from '../auth/session';
import { CHAT_COPY as COPY, STAGE_ORDER, stageLabel } from './chat-copy';
import { requirementRows } from './requirement-rows';
import styles from './chat-workspace.module.css';

/** Toast "Solusi tersimpan" hilang sendiri — 2800 ms di prototipe. */
const TOAST_MS = 2800;
/**
 * Jeda "Solusi siap!" dari prototipe: kartu analisis sempat terlihat selesai sebelum
 * solusinya muncul, supaya perpindahannya terbaca alih-alih melompat. Ini irama
 * presentasi, bukan timer pengganti latensi — yang itu sengaja tidak disalin.
 */
const SOLUTION_READY_HOLD_MS = 1500;
/** Welcome diam 15 detik dengan composer kosong → mascot tertidur (prototipe, §7). */
const WELCOME_SLEEP_MS = 15_000;

interface ChatTurn {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly cards: readonly AssistantCard[];
}

export function ChatWorkspace() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [state, setState] = useState<RequirementState | null>(null);
  const [stages, setStages] = useState<Readonly<Partial<Record<AnalysisStage, StageStatus>>>>({});
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [handoffState, setHandoffState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const [toastOn, setToastOn] = useState(false);
  const [sleepy, setSleepy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [openProduct, setOpenProduct] = useState<DrawerSelection | null>(null);
  const [solution, setSolution] = useState<Recommendation | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [history, setHistory] = useState<
    | { kind: 'loading' }
    | { kind: 'guest' }
    | { kind: 'list'; items: readonly ConversationSummary[] }
  >({ kind: 'loading' });
  const streamRef = useRef<HTMLDivElement>(null);

  /**
   * Memulihkan sesi LEBIH DULU, lalu memuat riwayat.
   *
   * Access token hidup di memori (docs/SECURITY.md §3), jadi muat ulang halaman
   * menghapusnya. Tanpa pemulihan ini, pengguna yang sudah masuk terlihat seperti tamu
   * setelah refresh dan riwayatnya ditolak 403 — gejala yang membingungkan karena ia
   * merasa masih masuk.
   */
  useEffect(() => {
    let cancelled = false;
    // Riwayat hanya untuk akun; tamu tidak perlu ditolak 403 untuk mengetahuinya.
    void restoreSession()
      .then((restored) => (restored ? fetchHistory() : null))
      .then((result) => {
        if (cancelled) return;
        setHistory(
          result?.kind === 'ok' ? { kind: 'list', items: result.items } : { kind: 'guest' },
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    createConversation()
      .then((conversation) => {
        if (!cancelled) setConversationId(conversation.id);
      })
      .catch(() => {
        if (!cancelled) setError(COPY.llmUnavailable);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Gulir ke bawah saat ada giliran baru — percakapan tumbuh ke bawah.
  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight });
  }, [turns, stages, sending]);

  useEffect(() => {
    if (!toastOn) return;
    const timer = setTimeout(() => setToastOn(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toastOn]);

  // Mengetik atau mengirim membangunkannya; diam lagi 15 detik menidurkannya lagi.
  useEffect(() => {
    setSleepy(false);
    if (turns.length > 0 || draft !== '') return;
    const timer = setTimeout(() => setSleepy(true), WELCOME_SLEEP_MS);
    return () => clearTimeout(timer);
  }, [turns.length, draft]);

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text || !conversationId || sending) return;

    setDraft('');
    setError(null);
    setStages({});
    setSending(true);
    setTurns((previous) => [
      ...previous,
      { id: `u-${previous.length}`, role: 'user', text, cards: [] },
    ]);

    const assistantId = `a-${Date.now()}`;
    let assistantCards: AssistantCard[] = [];
    let assistantText = '';

    const apply = (event: AssistantStreamEvent): void => {
      switch (event.type) {
        case 'requirement.updated':
          setState(event.state);
          break;
        case 'stage':
          // Tahap pesan biasa ("Memahami kebutuhan") TIDAK membuka kartu analisis —
          // di prototipe kartu itu hanya ada saat "Analisis kebutuhan" ditekan;
          // selama pesan berjalan yang tampil titik berpikir.
          break;
        case 'token':
          assistantText += event.text;
          break;
        case 'card':
          assistantCards = [...assistantCards, event.card];
          break;
        case 'error':
          setError(COPY.llmUnavailable);
          break;
        default:
          break;
      }
    };

    try {
      await sendMessage(conversationId, text, apply);
    } catch {
      setError(COPY.llmUnavailable);
    } finally {
      if (assistantText !== '' || assistantCards.length > 0) {
        setTurns((previous) => [
          ...previous,
          { id: assistantId, role: 'assistant', text: assistantText, cards: assistantCards },
        ]);
      }
      setSending(false);
    }
  }, [conversationId, draft, sending]);

  const answerChip = useCallback((question: ClarificationQuestion, option: string) => {
    setDraft(`${question.question} ${option}`);
  }, []);

  /**
   * Menyerahkan kasus ke tim teknis. Kebutuhan yang sudah terkumpul disalin di sisi
   * server, jadi pengguna tidak mengulang ceritanya — itu janji layar 11.
   */
  const handoff = useCallback(
    (reason: string) => {
      if (!conversationId || handoffState !== 'idle') return;
      setHandoffState('sending');
      void sendToTechnicalTeam(conversationId, reason).then((result) => {
        setHandoffState(result ? 'sent' : 'idle');
      });
    },
    [conversationId, handoffState],
  );

  /**
   * Menjalankan analisis. Tahap-tahapnya mengalir ke indikator yang sama seperti giliran
   * chat, lalu solusinya diambil dan dirender — gambar, tabel, dan BOM semuanya dari
   * rekomendasi yang tersimpan, bukan dihitung di klien.
   */
  const analyze = useCallback(() => {
    if (!conversationId || analyzing) return;
    setAnalyzing(true);
    setStages({});
    setError(null);

    void runAnalysis(conversationId, (event) => {
      if (event.type === 'stage') {
        setStages((previous) => ({ ...previous, [event.stage]: event.status }));
      } else if (event.type === 'error') {
        setError(COPY.llmUnavailable);
      }
    })
      .then(async (recommendationId) => {
        if (!recommendationId) return;
        const recommendation = await fetchRecommendation(recommendationId);
        await new Promise((resolve) => setTimeout(resolve, SOLUTION_READY_HOLD_MS));
        setSolution(recommendation);
      })
      .catch(() => setError(COPY.llmUnavailable))
      .finally(() => setAnalyzing(false));
  }, [analyzing, conversationId]);

  /**
   * "Simpan hasil konsultasi". Digerbang `SAVE_SOLUTION` di API: tamu menerima 403 dan
   * tombolnya tetap tidak berubah — UI tidak berpura-pura berhasil.
   */
  const save = useCallback(() => {
    if (!conversationId || saveState === 'saved') return;
    void saveConversation(conversationId).then((ok) => {
      if (!ok) return;
      setSaveState('saved');
      setToastOn(true);
    });
  }, [conversationId, saveState]);

  const rows = state ? requirementRows(state) : [];
  const filled = state?.completeness.filled ?? 0;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandRow}>
          <SnoutyAvatar mood="idle" size={28} />
          <div className={styles.brandText}>
            <div className={styles.brandName}>{COPY.brand.name}</div>
            <div className={styles.brandKicker}>{COPY.brand.kicker}</div>
          </div>
        </div>

        <button type="button" className={styles.newButton}>
          <span className={styles.newPlus}>+</span>
          <span>{COPY.newConversation}</span>
        </button>

        <div className={styles.sidebarGroup}>
          <div className={styles.sidebarSection}>{COPY.historyTitle}</div>

          {history.kind === 'guest' && <p className={styles.historyGuest}>{COPY.historyGuest}</p>}

          {history.kind === 'list' && history.items.length === 0 && (
            <p className={styles.historyGuest}>{COPY.historyEmpty}</p>
          )}

          {history.kind === 'list' &&
            history.items.map((item) => (
              <div
                key={item.id}
                className={[
                  styles.historyItem,
                  item.id === conversationId ? styles.historyItemActive : '',
                ].join(' ')}
              >
                <span className={styles.historyTitleText}>{item.title ?? 'Konsultasi baru'}</span>
                <span className={styles.historyMeta}>{item.status}</span>
              </div>
            ))}
        </div>

        {/* Ikon kotak kecil mengikuti prototipe: satu garis tebal di kiri untuk pengetahuan produk. */}
        <div className={styles.sidebarLinks}>
          <span className={styles.sidebarLink}>
            <span className={styles.iconSquare} />
            {COPY.savedSolutions}
          </span>
          <span className={styles.sidebarLink}>
            <span className={[styles.iconSquare, styles.iconSquareBook].join(' ')} />
            {COPY.productKnowledge}
          </span>
        </div>
      </aside>

      <nav className={styles.navRail} aria-label="Navigasi utama">
        <SnoutyAvatar mood="idle" size={28} />
        <button type="button" className={styles.railNew} aria-label={COPY.newConversation}>
          +
        </button>
        <span className={styles.railDivider} />
        <span className={styles.railIcon} title={COPY.historyTitle}>
          <span className={styles.railLines} />
        </span>
        <span className={styles.railIcon} title={COPY.savedSolutions}>
          <span className={styles.iconSquare} />
        </span>
        <span className={styles.railIcon} title={COPY.productKnowledge}>
          <span className={[styles.iconSquare, styles.iconSquareBook].join(' ')} />
        </span>
      </nav>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerTitle}>{COPY.headerTitle}</span>
            {/* Badge status dari prototipe: mono, berbingkai, "LANGKAH n DARI 4". */}
            <span className={styles.headerStatus}>
              {solution !== null ? COPY.solutionReady : COPY.stepStatus(filled)}
            </span>
          </div>
          {/* "Buat laporan" di header, seperti prototipe, begitu solusi ada. */}
          {solution !== null && (
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.headerPrimary}
                onClick={() => setReportOpen(true)}
              >
                {REPORT_COPY.open}
              </button>
            </div>
          )}
          <button
            type="button"
            className={styles.panelToggle}
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
          >
            {panelOpen ? '»' : '«'}
          </button>
        </header>

        {/*
          Layar sambutan di dalam ruang konsultasi (prototipe, state `isWelcome`): mascot
          dengan gelembung komik, headline besar, lalu composer BERBENTUK KARTU di tengah —
          bukan bar di bawah. Begitu ada giliran pertama, ia berganti menjadi aliran chat.
        */}
        {turns.length === 0 ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeInner}>
              <div className={styles.welcomeMascotRow}>
                <Snouty mood={sleepy ? 'sleep' : 'idle'} size={104} />
                <div className={styles.welcomeBubble}>
                  {sleepy ? COPY.welcome.sleepBubble : COPY.welcome.bubble}
                </div>
              </div>

              <div className={styles.welcomeText}>
                <h1 className={styles.welcomeHeadline}>{COPY.welcome.headline}</h1>
                <p className={styles.welcomeBody}>{COPY.welcome.body}</p>
              </div>

              <div className={styles.composerCard}>
                <input
                  className={styles.composerCardInput}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void submit();
                    }
                  }}
                  placeholder={COPY.composerPlaceholder}
                  aria-label={COPY.composerPlaceholder}
                  disabled={conversationId === null}
                />
                <div className={styles.composerCardFoot}>
                  {/* Unggahan denah menunggu endpoint berkas (OQ-07). */}
                  <span className={styles.attachButton}>
                    <span className={styles.iconSquare} />
                    {COPY.attachPlan}
                  </span>
                  <button
                    type="button"
                    className={styles.sendButton}
                    onClick={() => void submit()}
                    disabled={draft.trim() === '' || sending || conversationId === null}
                  >
                    {COPY.send}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.stream} ref={streamRef} aria-live="polite">
            {turns.map((turn) =>
              turn.role === 'user' ? (
                <div key={turn.id} className={styles.userRow}>
                  <div className={styles.userBubble}>{turn.text}</div>
                </div>
              ) : (
                <div key={turn.id} className={styles.assistantRow}>
                  <SnoutyAvatar mood={moodForCards(turn.cards)} size={30} />
                  <div className={styles.assistantCol}>
                    {turn.text !== '' && <div className={styles.assistantBubble}>{turn.text}</div>}
                    {turn.cards.map((card, index) => (
                      <CardView
                        key={index}
                        card={card}
                        onChip={answerChip}
                        onHandoff={handoff}
                        handoffState={handoffState}
                        onSave={save}
                        saveState={saveState}
                        onAnalyze={analyze}
                        analyzing={analyzing}
                        onOpenProduct={(product) =>
                          setOpenProduct({ productId: product.productId })
                        }
                      />
                    ))}
                  </div>
                </div>
              ),
            )}

            {sending && (
              <div className={styles.thinkingRow} role="status" aria-label={COPY.thinking}>
                <SnoutyAvatar mood="think" size={30} />
                <div className={styles.dots} aria-hidden="true">
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </div>
              </div>
            )}

            {/* Kartu "Yang sudah saya pahami" — grid 3 kolom dengan badge hijau jumlah data. */}
            {state !== null && filled > 0 && <UnderstoodCard rows={rows} filled={filled} />}

            {Object.keys(stages).length > 0 && <StageIndicator stages={stages} />}

            {openProduct && (
              <ProductDrawer selection={openProduct} onClose={() => setOpenProduct(null)} />
            )}

            {reportOpen && solution !== null && (
              <ReportModal recommendationId={solution.id} onClose={() => setReportOpen(false)} />
            )}

            {toastOn && (
              <div className={styles.toast} role="status">
                <Snouty mood="thanks" size={52} />
                <div className={styles.toastText}>
                  <div className={styles.toastTitle}>{COPY.toast.title}</div>
                  <div className={styles.toastSub}>{COPY.toast.sub}</div>
                </div>
              </div>
            )}

            {solution !== null && (
              <SolutionView
                recommendation={solution}
                onFixAssumption={(fieldPath) => setDraft(`Ubah ${fieldPath}: `)}
              />
            )}
            {error !== null && (
              <div className={styles.errorCard} role="status">
                {error}
              </div>
            )}
          </div>
        )}

        {turns.length > 0 && (
          <div className={styles.composerWrap}>
            <div className={styles.composerCard}>
              <input
                className={styles.composerCardInput}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                placeholder={COPY.composerPlaceholderChat}
                aria-label={COPY.composerPlaceholderChat}
              />
              <button
                type="button"
                className={styles.sendButton}
                onClick={() => void submit()}
                disabled={draft.trim() === '' || sending}
              >
                {COPY.send}
              </button>
            </div>
          </div>
        )}
      </main>

      {/*
        Panel terciut menjadi rail 44px, bukan hilang: prototipe menampilkan teks vertikal
        "KEBUTUHAN & SOLUSI" beserta jumlah data, sehingga pengguna tetap tahu panel itu ada
        dan berapa banyak yang sudah terbaca.
      */}
      {!panelOpen && (
        <aside
          className={styles.panelRail}
          onClick={() => setPanelOpen(true)}
          title={COPY.expandPanel}
        >
          <span className={styles.railToggle}>«</span>
          <span className={styles.railVertical}>{COPY.railLabel}</span>
          <span className={styles.railCount}>
            <span className={styles.railCountValue}>{filled}</span>
            <span className={styles.railCountUnit}>{COPY.railUnit}</span>
          </span>
        </aside>
      )}

      {panelOpen && (
        <aside className={styles.panel} aria-label={COPY.panelTitle}>
          <div className={styles.panelHead}>
            <span>{COPY.panelTitle}</span>
            <button
              type="button"
              className={styles.panelToggle}
              onClick={() => setPanelOpen(false)}
              title={COPY.collapsePanel}
              aria-label={COPY.collapsePanel}
            >
              »
            </button>
          </div>
          <div className={styles.panelBody}>
            <section className={styles.panelSection}>
              <div className={styles.panelKicker}>{COPY.requirementsLabel}</div>
              {rows.map((row) => (
                <div key={row.label} className={styles.reqRow}>
                  <span className={styles.reqLabel}>{row.label}</span>
                  <span
                    className={[
                      styles.reqValue,
                      row.provenance === 'ASSUMED' || row.provenance === 'ESTIMATED'
                        ? styles.reqValueAssumed
                        : '',
                      row.provenance === 'UNAVAILABLE' ? styles.reqValueMissing : '',
                    ].join(' ')}
                    title={row.reason}
                  >
                    {row.display}
                  </span>
                </div>
              ))}
            </section>

            <section className={styles.panelSection}>
              <div className={styles.panelKicker}>{COPY.completenessLabel}</div>
              <div className={styles.meter}>
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={[styles.meterBar, index < filled ? styles.meterBarOn : ''].join(' ')}
                  />
                ))}
              </div>
              <p className={styles.meterNote}>{completenessNote(filled)}</p>
            </section>

            <section className={styles.panelSection}>
              <div className={styles.boundaryTitle}>{COPY.boundaryTitle}</div>
              <p className={styles.boundaryBody}>{COPY.boundaryBody}</p>
            </section>
          </div>
        </aside>
      )}
    </div>
  );
}

/**
 * Teks di bawah meter — salinan desain. Dihitung dari jumlah terisi, sama seperti
 * `completenessCaption` di server; keduanya mengikuti kalimat yang sama.
 */
function completenessNote(filled: number): string {
  const missing = 4 - filled;
  if (missing <= 0) {
    return 'Data inti sudah lengkap. Nilai yang tidak diberikan tetap ditandai sebagai asumsi.';
  }
  return `${missing} kelompok data lagi sebelum SNOUTY dapat menyusun rekomendasi.`;
}

/**
 * Kartu "Yang sudah saya pahami" (prototipe). Grid tiga kolom, badge hijau berisi jumlah
 * data yang terbaca — hijau karena ini **fakta yang dinyatakan pengguna**, bukan asumsi
 * sistem; itu pembedaan yang sama yang dijaga `<ProvenanceTag>`.
 */
function UnderstoodCard({
  rows,
  filled,
}: {
  rows: readonly { label: string; display: string }[];
  filled: number;
}) {
  return (
    <div className={styles.understoodCard}>
      <div className={styles.understoodHead}>
        <span className={styles.understoodTitle}>{COPY.understood.title}</span>
        <span className={styles.understoodBadge}>{COPY.understood.readCount(filled)}</span>
      </div>
      <div className={styles.understoodGrid}>
        {rows.map((row) => (
          <div key={row.label} className={styles.understoodCell}>
            <span className={styles.understoodLabel}>{row.label}</span>
            <span className={styles.understoodValue}>{row.display}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageIndicator({
  stages,
}: {
  stages: Readonly<Partial<Record<AnalysisStage, StageStatus>>>;
}) {
  const statuses = STAGE_ORDER.map((stage) => stages[stage]);
  const done = statuses.filter((status) => status === 'done').length;
  const active = statuses.filter((status) => status === 'active').length;
  const phase = statuses.includes('failed')
    ? 'failed'
    : done === STAGE_ORDER.length
      ? 'done'
      : 'running';
  // Prototipe: (langkah + 1) / 5 — tahap yang sedang berjalan ikut terhitung.
  const pct = Math.round(((done + active) / STAGE_ORDER.length) * 100);

  return (
    <div className={styles.stageCard} role="status" aria-live="polite">
      <div className={styles.stageHead}>
        {/* Prototipe: think selama dua tahap pertama, lalu write; happy saat selesai, fail saat gagal. */}
        <Snouty
          mood={
            phase === 'failed' ? 'fail' : phase === 'done' ? 'happy' : done < 2 ? 'think' : 'write'
          }
          size={84}
        />
        <div className={styles.progressTrack} aria-hidden="true">
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <h3 className={styles.stageTitle}>{COPY.analysis[phase].title}</h3>
      <p className={styles.stageSub}>{COPY.analysis[phase].sub}</p>
      {STAGE_ORDER.map((stage) => {
        const status = stages[stage];
        return (
          <div key={stage} className={styles.stageRow}>
            <span
              className={[
                styles.stageDot,
                status === 'done' ? styles.stageDotDone : '',
                status === 'active' ? styles.stageDotActive : '',
                status === 'failed' ? styles.stageDotFailed : '',
              ].join(' ')}
            />
            <span className={status ? styles.stageLabelOn : styles.stageLabel}>
              {stageLabel(stage)}
            </span>
          </div>
        );
      })}
      <p className={styles.stageFooter}>{CHAT_COPY_FOOTER}</p>
    </div>
  );
}

const CHAT_COPY_FOOTER = COPY.analysisFooter;

function CardView({
  card,
  onChip,
  onHandoff,
  handoffState,
  onSave,
  saveState,
  onAnalyze,
  analyzing,
  onOpenProduct,
}: {
  card: AssistantCard;
  onChip: (question: ClarificationQuestion, option: string) => void;
  onHandoff: (reason: string) => void;
  handoffState: 'idle' | 'sending' | 'sent';
  onSave: () => void;
  saveState: 'idle' | 'saved';
  onAnalyze: () => void;
  analyzing: boolean;
  onOpenProduct: (product: ProductCardDto) => void;
}) {
  if (card.kind === 'product') {
    return <ProductLookupCards products={card.products} onOpen={onOpenProduct} />;
  }

  if (card.kind === 'clarification') {
    // Layar 03: pertanyaan BERNOMOR — maksimum empat, dan nomornya membuat
    // panjangnya terbaca sebagai "ada ujungnya", bukan kuesioner tanpa batas.
    return (
      <div className={styles.clarificationCard}>
        <div className={styles.cardKicker}>{COPY.clarificationTitle}</div>
        {card.questions.map((question, index) => (
          <div key={question.id} className={styles.question}>
            <div className={styles.questionHead}>
              <span className={styles.questionNum}>{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.questionText}>{question.question}</span>
            </div>
            <div className={styles.chips}>
              {question.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={styles.chip}
                  onClick={() => onChip(question, option)}
                >
                  {option}
                </button>
              ))}
              {question.allowUnknown && (
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => onChip(question, 'Belum tahu')}
                >
                  Belum tahu
                </button>
              )}
            </div>
          </div>
        ))}
        {card.questions.length >= 3 && (
          <button
            type="button"
            className={styles.skipDefaults}
            onClick={() => onChip(card.questions[0]!, 'Belum tahu')}
          >
            {COPY.skipToDefaults}
          </button>
        )}
      </div>
    );
  }

  if (card.kind === 'cta') {
    return (
      <div className={styles.ctaCard}>
        <span>Data inti sudah lengkap.</span>
        <button type="button" className={styles.ctaButton} onClick={onAnalyze} disabled={analyzing}>
          {analyzing ? 'Menganalisis…' : 'Analisis kebutuhan'}
        </button>
        <button
          type="button"
          className={styles.chip}
          onClick={onSave}
          disabled={saveState === 'saved'}
        >
          {saveState === 'saved' ? COPY.saved : COPY.saveSolution}
        </button>
      </div>
    );
  }

  if (card.kind === 'criteria') {
    // Layar 08: menolak membandingkan merek TANPA menjelaskan cara memilih akan
    // meninggalkan pengguna tanpa jalan keluar — kartu inilah jalan keluarnya.
    return (
      <div className={styles.criteriaCard}>
        <div className={styles.cardKicker}>{COPY.criteriaTitle}</div>
        {card.items.map((item, index) => (
          <div key={index} className={styles.criteriaRow}>
            <span className={styles.criteriaNum}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.criteriaDetail}>{item.detail}</span>
          </div>
        ))}
      </div>
    );
  }

  if (card.kind === 'unsupported') {
    // Layar 11: validasi teknis. Kebutuhan yang sudah terkumpul ditampilkan supaya
    // pengguna melihat bahwa ceritanya tidak hilang.
    return (
      <div className={styles.unsupportedCard}>
        <div className={styles.unsupportedHead}>
          <span className={styles.unsupportedMark} />
          <span className={styles.unsupportedTitle}>{COPY.unsupported.title}</span>
        </div>
        {card.reasons.map((reason) => (
          <p key={reason} className={styles.unsupportedReason}>
            {reason}
          </p>
        ))}
        {card.captured.length > 0 && (
          <div className={styles.capturedBlock}>
            <div className={styles.cardKicker}>{COPY.unsupported.capturedLabel}</div>
            <div className={styles.capturedList}>
              {card.captured.map((row) => (
                <div key={row.label} className={styles.capturedRow}>
                  <span className={styles.capturedLabel}>{row.label}</span>
                  <span className={styles.capturedValue}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className={styles.slaNote}>{COPY.unsupported.slaNote(card.slaHours)}</p>
        <div className={styles.unsupportedActions}>
          <button
            type="button"
            className={styles.ctaButton}
            onClick={() => onHandoff(card.reasons[0] ?? 'Di luar cakupan rekomendasi otomatis.')}
            disabled={handoffState !== 'idle'}
          >
            {handoffState === 'sent'
              ? COPY.unsupported.sent
              : handoffState === 'sending'
                ? COPY.unsupported.sending
                : COPY.unsupported.sendToTechnical}
          </button>
          {/* Unduhan ringkasan kebutuhan (REPORT.md §9) menyusul bersama worker PDF. */}
          <button type="button" className={styles.chip} disabled>
            {COPY.unsupported.downloadSummary}
          </button>
        </div>
      </div>
    );
  }

  // Kartu produk dan ringkasan datang di Fase 6–7.
  return null;
}
