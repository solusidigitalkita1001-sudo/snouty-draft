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
  fetchCatalogVersion,
  fetchConversation,
  fetchHistory,
  fetchRecommendation,
  fetchRequirement,
  patchRequirement,
  runAnalysis,
  saveConversation,
  sendMessage,
  sendToTechnicalTeam,
  type ConversationSummary,
} from './chat-api';
import { SolutionView } from '../solution/solution-view';
import { getCurrentUser, restoreSession, type CurrentUser } from '../auth/session';
import { CHAT_COPY as COPY, STAGE_ORDER, stageLabel } from './chat-copy';
import { MISSING, requirementRows } from './requirement-rows';
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
/** Di bawah ini sidebar dan rail hilang, header dapat "+ Baru" + "Riwayat", panel jadi overlay. */
const NARROW_QUERY = '(max-width: 1079px)';
/** Di bawah ini composer jadi pil, "Kebutuhan (n)" di header (board 13a). */
const MOBILE_QUERY = '(max-width: 719px)';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];

/** "12 SEP" — meta riwayat prototipe. */
function historyDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

/** `matchMedia` sebagai state React — SSR aman (false), lalu mengikuti viewport. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = (): void => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

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
  // Prototipe: panel tertutup secara bawaan di setiap lebar; rail 44px yang membukanya.
  const [panelOpen, setPanelOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [reopened, setReopened] = useState(false);
  const [catalogLabel, setCatalogLabel] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  // Mode "Ubah" panel: nilai sementara per field sampai "Selesai" dikirim sekaligus.
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Readonly<Record<string, string>>>({});
  const [editStatus, setEditStatus] = useState<'idle' | 'saving' | 'failed'>('idle');
  const narrow = useMediaQuery(NARROW_QUERY);
  const mobile = useMediaQuery(MOBILE_QUERY);
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
      .then((restored) => {
        if (!cancelled) setUser(getCurrentUser());
        return restored ? fetchHistory() : null;
      })
      .then((result) => {
        if (cancelled) return;
        setHistory(
          result?.kind === 'ok' ? { kind: 'list', items: result.items } : { kind: 'guest' },
        );
      });
    void fetchCatalogVersion().then((label) => {
      if (!cancelled) setCatalogLabel(label);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Menjadi sempit menutup panel (prototipe); overlay tidak boleh tiba-tiba menutupi isi.
  useEffect(() => {
    if (narrow) setPanelOpen(false);
  }, [narrow]);

  const refreshHistory = useCallback(() => {
    if (history.kind === 'guest') return;
    void fetchHistory().then((result) => {
      if (result.kind === 'ok') setHistory({ kind: 'list', items: result.items });
    });
  }, [history.kind]);

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

  /** Mengirim teks apa pun — composer, chip jawaban, maupun saran lanjutan. */
  const submitText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;

      // Percakapan dibuat SAAT pesan pertama, bukan saat halaman dibuka — kalau tidak,
      // setiap kunjungan meninggalkan "Konsultasi baru" kosong di riwayat.
      let id = conversationId;
      if (id === null) {
        try {
          id = (await createConversation()).id;
          setConversationId(id);
        } catch {
          setError(COPY.llmUnavailable);
          return;
        }
      }
      const activeId = id;

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
            // Judul aktif diturunkan dari kebutuhan, seperti `titleFrom` prototipe.
            setActiveTitle(
              COPY.titleFor(
                event.state.building.type.value as string | null,
                event.state.building.floors.value as number | null,
              ),
            );
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
        await sendMessage(activeId, text, apply);
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
        // Judulnya baru ada setelah pesan pertama — muat ulang supaya riwayat ikut.
        refreshHistory();
      }
    },
    [conversationId, refreshHistory, sending],
  );

  const submit = useCallback(() => submitText(draft), [draft, submitText]);

  // Chip jawaban langsung dikirim sebagai pesan (prototipe `answer`), bukan mengisi draft.
  const answerChip = useCallback(
    (_question: ClarificationQuestion, option: string) => void submitText(option),
    [submitText],
  );

  /** "+ Konsultasi Baru" — kembali ke sambutan dengan percakapan baru (prototipe `reset`). */
  const reset = useCallback(() => {
    setTurns([]);
    setDraft('');
    setState(null);
    setStages({});
    setError(null);
    setSolution(null);
    setSaveState('idle');
    setHandoffState('idle');
    setReportOpen(false);
    setOpenProduct(null);
    setActiveTitle(null);
    setReopened(false);
    setMenuOpen(false);
    setPanelOpen(false);
    setEditing(false);
    setEdits({});
    // Tidak membuat percakapan di sini — baru saat pesan pertama dikirim.
    setConversationId(null);
    refreshHistory();
  }, [refreshHistory]);

  /** Membuka kembali riwayat (layar 12): pesan dari server, panel dari snapshot terkini. */
  const openHistory = useCallback(
    (item: ConversationSummary) => {
      setMenuOpen(false);
      if (item.id === conversationId) return;
      void Promise.all([fetchConversation(item.id), fetchRequirement(item.id)]).then(
        ([detail, requirement]) => {
          if (!detail) {
            setError(COPY.llmUnavailable);
            return;
          }
          setTurns(
            detail.messages
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .filter((m) => m.text !== '' || m.cards.length > 0)
              .map((m) => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                text: m.text,
                cards: m.cards,
              })),
          );
          setState(requirement);
          setConversationId(item.id);
          setActiveTitle(item.title ?? COPY.titleFor(null, null));
          setReopened(true);
          setSolution(null);
          setStages({});
          setError(null);
          setSaveState(item.status === 'SAVED' ? 'saved' : 'idle');
        },
      );
    },
    [conversationId],
  );

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

  /**
   * "Selesai": kirim hanya field yang benar-benar diubah, nol LLM. Bila solusi sudah
   * ada, analisis dijalankan lagi — kontrak §3 menjanjikan solusi yang dihitung ulang,
   * dan `/analyze` adalah satu-satunya jalur yang menghasilkan trace.
   */
  const finishEdit = useCallback(async () => {
    if (!conversationId) return;
    const changes = rows
      .filter((row) => row.path in edits)
      .map((row) => ({
        path: row.path,
        value: row.editor.kind === 'number' ? Number(edits[row.path]) : edits[row.path],
      }))
      .filter((change) => change.value !== '' && !Number.isNaN(change.value as number))
      .filter(
        (change) =>
          String(change.value) !== String(rows.find((r) => r.path === change.path)?.raw ?? ''),
      );
    if (changes.length === 0) {
      setEditing(false);
      setEdits({});
      return;
    }
    setEditStatus('saving');
    const next = await patchRequirement(conversationId, changes);
    if (!next) {
      setEditStatus('failed');
      return;
    }
    setState(next);
    setEditStatus('idle');
    setEditing(false);
    setEdits({});
    if (solution !== null) analyze();
  }, [analyze, conversationId, edits, rows, solution]);
  // Prototipe `readCount`: seluruh field yang terbaca (sampai 7), bukan hanya empat inti.
  const readCount = rows.filter((row) => row.display !== 'Belum diisi').length;
  const inConversation = turns.length > 0;
  const activeStatus = solution
    ? COPY.activeStatus.ready
    : reopened
      ? COPY.activeStatus.reopened
      : COPY.activeStatus.inProgress;
  // Tanpa judul = tanpa pesan (judul diset saat pesan pertama): tidak ada yang bisa dibuka.
  const otherHistory =
    history.kind === 'list'
      ? history.items.filter((item) => item.id !== conversationId && item.title !== null)
      : [];

  const historyList = (itemClass: string) =>
    otherHistory.map((item) => (
      <button key={item.id} type="button" className={itemClass} onClick={() => openHistory(item)}>
        <span className={styles.historyTitleText}>{item.title ?? COPY.titleFor(null, null)}</span>
        <span className={styles.historyMeta}>{historyDate(item.updatedAt)}</span>
      </button>
    ));

  const footerAvatar = (
    <span className={styles.footerAvatar} aria-hidden="true">
      {user ? initialsOf(user.name) : 'T'}
    </span>
  );

  return (
    <div className={styles.shell}>
      {/* Sidebar 236px ATAU rail 60px — tidak pernah keduanya (prototipe `navCollapsed`). */}
      {!narrow && !navCollapsed && (
        <aside className={styles.sidebar}>
          <div className={styles.brandRow}>
            <SnoutyAvatar mood="idle" size={28} />
            <div className={styles.brandText}>
              <div className={styles.brandName}>{COPY.brand.name}</div>
              <div className={styles.brandKicker}>{COPY.brand.kicker}</div>
            </div>
            <button
              type="button"
              className={styles.navToggle}
              onClick={() => setNavCollapsed(true)}
              title={COPY.collapseSidebar}
              aria-label={COPY.collapseSidebar}
            >
              «
            </button>
          </div>

          <button type="button" className={styles.newButton} onClick={reset}>
            <span className={styles.newPlus}>+</span>
            <span>{COPY.newConversation}</span>
          </button>

          <div className={styles.sidebarGroup}>
            <div className={styles.sidebarSection}>{COPY.historyTitle}</div>

            {/* Percakapan aktif: blok merah lembut + garis kiri merek, status mono merah. */}
            {inConversation && (
              <div className={styles.historyActive} aria-current="true">
                <span className={styles.historyActiveTitle}>
                  {activeTitle ?? COPY.titleFor(null, null)}
                </span>
                <span className={styles.historyActiveStatus}>{activeStatus}</span>
              </div>
            )}

            {history.kind === 'guest' && <p className={styles.historyGuest}>{COPY.historyGuest}</p>}
            {history.kind === 'list' && otherHistory.length === 0 && !inConversation && (
              <p className={styles.historyGuest}>{COPY.historyEmpty}</p>
            )}
            {historyList(styles.historyItem!)}
          </div>

          {/* Tautan ini juga tanpa aksi di prototipe (layar 12 belum ada). */}
          <div className={styles.sidebarLinks}>
            <span className={styles.sidebarLink} title={COPY.attachSoon}>
              <span className={styles.iconSquare} />
              {COPY.savedSolutions}
            </span>
            <span className={styles.sidebarLink}>
              <span className={[styles.iconSquare, styles.iconSquareBook].join(' ')} />
              {COPY.productKnowledge}
            </span>
          </div>

          <div className={styles.sidebarFooter}>
            {footerAvatar}
            <div className={styles.footerText}>
              <span className={styles.footerName}>{user?.name ?? COPY.footer.guestName}</span>
              {user ? (
                <span className={styles.footerRole}>{COPY.footer.role}</span>
              ) : (
                <span className={styles.footerRole}>
                  <a href="/login">{COPY.footer.login}</a> ·{' '}
                  <a href="/register">{COPY.footer.register}</a>
                </span>
              )}
            </div>
          </div>
        </aside>
      )}

      {!narrow && navCollapsed && (
        <nav className={styles.navRail} aria-label="Navigasi utama">
          <SnoutyAvatar mood="idle" size={28} />
          <button
            type="button"
            className={styles.navToggle}
            onClick={() => setNavCollapsed(false)}
            title={COPY.expandSidebar}
            aria-label={COPY.expandSidebar}
          >
            »
          </button>
          <button
            type="button"
            className={styles.railNew}
            aria-label={COPY.newConversation}
            onClick={reset}
          >
            +
          </button>
          <span className={styles.railDivider} />
          <button
            type="button"
            className={styles.railIcon}
            title={COPY.historyTitle}
            aria-label={COPY.historyTitle}
            onClick={() => setNavCollapsed(false)}
          >
            <span className={styles.railLines} />
          </button>
          <span className={styles.railIcon} title={COPY.savedSolutions}>
            <span className={styles.iconSquare} />
          </span>
          <span className={styles.railIcon} title={COPY.productKnowledge}>
            <span className={[styles.iconSquare, styles.iconSquareBook].join(' ')} />
          </span>
          <span className={styles.railBottom}>{footerAvatar}</span>
        </nav>
      )}

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {/* Sempit (<1080): sidebar hilang, "+ Baru" dan menu "Riwayat" pindah ke header. */}
            {narrow && (
              <>
                <button
                  type="button"
                  className={styles.headerNew}
                  onClick={reset}
                  aria-label={COPY.newConversation}
                >
                  <span className={styles.newPlus}>+</span>
                  {!mobile && <span>{COPY.newShort}</span>}
                </button>
                <div className={styles.menuWrap}>
                  <button
                    type="button"
                    className={styles.headerMenuButton}
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-expanded={menuOpen}
                  >
                    {COPY.menu}
                  </button>
                  {menuOpen && (
                    <div className={styles.menu} role="menu">
                      <div className={styles.menuTitle}>{COPY.menuTitle}</div>
                      {history.kind === 'guest' && (
                        <p className={styles.historyGuest}>{COPY.historyGuest}</p>
                      )}
                      {history.kind === 'list' && otherHistory.length === 0 && (
                        <p className={styles.historyGuest}>{COPY.historyEmpty}</p>
                      )}
                      {historyList(styles.menuItem!)}
                      <div className={styles.menuDivider} />
                      <span className={styles.menuLink}>{COPY.savedSolutions}</span>
                      <span className={styles.menuLink}>{COPY.productKnowledge}</span>
                    </div>
                  )}
                </div>
              </>
            )}
            <span className={styles.headerTitle}>
              {inConversation ? (activeTitle ?? COPY.headerTitle) : COPY.headerWelcomeTitle}
            </span>
            {/* Badge mono berbingkai: versi katalog di sambutan, "LANGKAH n DARI 4" saat mengumpulkan. */}
            {!mobile && (
              <span className={styles.headerStatus}>
                {solution !== null
                  ? COPY.solutionReady
                  : inConversation
                    ? COPY.stepStatus(filled)
                    : COPY.catalogBadge(catalogLabel ?? '…')}
              </span>
            )}
          </div>
          <div className={styles.headerActions}>
            {/* Ponsel (board 13a): "Kebutuhan (n)" membuka panel sebagai lembar. */}
            {mobile && inConversation && (
              <button
                type="button"
                className={styles.headerNeeds}
                onClick={() => setPanelOpen(true)}
              >
                {COPY.mobileNeeds(readCount)}
              </button>
            )}
            {solution !== null && (
              <button
                type="button"
                className={styles.headerPrimary}
                onClick={() => setReportOpen(true)}
              >
                {REPORT_COPY.open}
              </button>
            )}
          </div>
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
                />
                <div className={styles.composerCardFoot}>
                  {/*
                    "Lampirkan denah" juga tanpa aksi di prototipe, dan `POST /uploads` baru ada
                    di kontrak. Chip-nya ditandai nonaktif dengan alasannya — tidak berpura-pura.
                  */}
                  <button
                    type="button"
                    className={styles.attachButton}
                    aria-disabled="true"
                    title={COPY.attachSoon}
                  >
                    <span className={styles.iconSquare} />
                    {COPY.attachPlan}
                  </button>
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
                // "Perbaiki asumsi ini" → panel terbuka dalam mode Ubah (prototipe).
                onFixAssumption={() => {
                  setPanelOpen(true);
                  setEditing(true);
                }}
              />
            )}
            {error !== null && (
              <div className={styles.errorCard} role="status">
                {error}
              </div>
            )}
          </div>
        )}

        {inConversation && (
          <div className={styles.composerWrap}>
            {/* Ponsel: bidang berbentuk pil + tombol kirim bulat 40px (board 13a). */}
            <div className={[styles.composerCard, mobile ? styles.composerPill : ''].join(' ')}>
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
                placeholder={mobile ? COPY.composerPlaceholderMobile : COPY.composerPlaceholderChat}
                aria-label={COPY.composerPlaceholderChat}
              />
              <button
                type="button"
                className={[styles.sendButton, mobile ? styles.sendRound : ''].join(' ')}
                onClick={() => void submit()}
                disabled={draft.trim() === '' || sending}
                aria-label={COPY.send}
              >
                {mobile ? COPY.mobileSend : COPY.send}
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
      {/* Panel dan rail-nya hanya ada setelah percakapan dimulai (prototipe: disembunyikan di sambutan). */}
      {inConversation && !panelOpen && !mobile && (
        <aside
          className={styles.panelRail}
          onClick={() => setPanelOpen(true)}
          title={COPY.expandPanel}
        >
          <span className={styles.railToggle}>«</span>
          <span className={styles.railVertical}>{COPY.railLabel}</span>
          <span className={styles.railCount}>
            <span className={styles.railCountValue}>{readCount}</span>
            <span className={styles.railCountUnit}>{COPY.railUnit}</span>
          </span>
          {solution !== null && <span className={styles.railDot} title={COPY.solutionReady} />}
        </aside>
      )}

      {inConversation && panelOpen && narrow && (
        <div className={styles.scrim} onClick={() => setPanelOpen(false)} aria-hidden="true" />
      )}

      {inConversation && panelOpen && (
        <aside
          className={[styles.panel, narrow ? styles.panelOverlay : ''].join(' ')}
          aria-label={COPY.panelTitle}
        >
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
              <div className={styles.panelKickerRow}>
                <div className={styles.panelKicker}>{COPY.requirementsLabel}</div>
                {/* "Ubah" ↔ "Selesai" — edit inline nol LLM (prototipe `editing`). */}
                {rows.length > 0 && (
                  <button
                    type="button"
                    className={styles.editToggle}
                    disabled={editStatus === 'saving'}
                    onClick={() => (editing ? void finishEdit() : setEditing(true))}
                  >
                    {editStatus === 'saving'
                      ? COPY.panelSaving
                      : editing
                        ? COPY.panelDone
                        : COPY.panelEdit}
                  </button>
                )}
              </div>
              {rows.map((row) => (
                <div
                  key={row.label}
                  className={[
                    styles.reqRow,
                    !editing && row.display === MISSING ? styles.reqRowMissing : '',
                  ].join(' ')}
                >
                  <span className={styles.reqLabel}>{row.label}</span>
                  {editing ? (
                    row.editor.kind === 'select' ? (
                      <select
                        className={styles.reqInput}
                        aria-label={row.label}
                        value={edits[row.path] ?? (row.raw === null ? '' : String(row.raw))}
                        onChange={(event) =>
                          setEdits((prev) => ({ ...prev, [row.path]: event.target.value }))
                        }
                      >
                        <option value="">{MISSING}</option>
                        {row.editor.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={styles.reqInput}
                        type="number"
                        inputMode="numeric"
                        aria-label={row.label}
                        min={row.editor.min}
                        max={row.editor.max}
                        value={edits[row.path] ?? (row.raw === null ? '' : String(row.raw))}
                        onChange={(event) =>
                          setEdits((prev) => ({ ...prev, [row.path]: event.target.value }))
                        }
                      />
                    )
                  ) : (
                    <span
                      className={[
                        styles.reqValue,
                        row.provenance === 'ASSUMED' || row.provenance === 'ESTIMATED'
                          ? styles.reqValueAssumed
                          : '',
                        row.display === MISSING ? styles.reqValueMissing : '',
                      ].join(' ')}
                      title={row.reason}
                    >
                      {row.display}
                    </span>
                  )}
                </div>
              ))}
              {editStatus === 'failed' && (
                <p className={styles.editError} role="alert">
                  {COPY.panelEditFailed}
                </p>
              )}
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

            {/* Layar solusi: empat saran lanjutan, masing-masing dikirim sebagai pesan. */}
            {solution !== null && (
              <section className={styles.panelSection}>
                <div className={styles.panelKicker}>{COPY.followUps.title}</div>
                <div className={styles.followUps}>
                  {COPY.followUps.items(solution.stats.mainSize).map((question) => (
                    <button
                      key={question}
                      type="button"
                      className={styles.followUp}
                      onClick={() => void submitText(question)}
                      disabled={sending}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </section>
            )}

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
          {analyzing ? 'Menganalisis…' : COPY.analyzeCta}
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
