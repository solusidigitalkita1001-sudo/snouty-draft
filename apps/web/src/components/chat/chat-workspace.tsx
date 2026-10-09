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
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { moodForCards } from '../mascot/mood';
import { Snouty, SnoutyAvatar } from '../mascot/snouty';
import { ProductDrawer, type DrawerSelection } from '../product/product-drawer';
import { ReportModal } from '../report/report-modal';
import { AccountModal } from '../account/account-modal';
import { reportCopy } from '../report/report-copy';
import { ThemeToggle } from '../theme-toggle';
import { LocaleToggle, useLocale } from '../locale';
import { AssistantMarkdown } from './assistant-markdown';
import { ComposerField } from './composer-field';
import { useRevealedText } from './assistant-reveal';
import { useCaseRows } from './use-case-rows';
import { ProductLookupCards } from './product-lookup-cards';
import {
  createConversation,
  fetchConversation,
  fetchHistory,
  fetchRecommendation,
  fetchRequirement,
  patchRequirement,
  submitClarification,
  overrideAssumption,
  runAnalysis,
  saveConversation,
  deleteConversation,
  restoreConversation,
  sendMessage,
  sendToTechnicalTeam,
  uploadPlan,
  type ConversationSummary,
  type AnswerMode,
} from './chat-api';
import { SolutionView, type SolutionTab } from '../solution/solution-view';
import { getCurrentUser, restoreSession, type CurrentUser } from '../auth/session';
import { gateHref, parseResume } from '../auth/resume-link';
import { chatCopy, STAGE_ORDER, stageLabel } from './chat-copy';
import { MISSING, requirementRows } from './requirement-rows';
import styles from './chat-workspace.module.css';

/** Teks UI mengikuti bahasa yang dipilih (Fase 15). */
function useChatCopy() {
  return chatCopy(useLocale().locale);
}

/** Toast "Solusi tersimpan" hilang sendiri — 2800 ms di prototipe. */
/** Jarak dari dasar (px) yang masih dianggap "di bawah" — di atas ini pengguna sedang membaca ke atas. */
const STICK_THRESHOLD_PX = 120;
const TOAST_MS = 2800;
/** Berapa lama "Urungkan" tersedia setelah menghapus dari riwayat. */
const UNDO_MS = 6000;
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
  /** Lahir di sesi ini (bukan dari riwayat) → jawabannya diungkap bertahap. */
  readonly fresh?: boolean;
  /**
   * Giliran ini memperbarui kebutuhan → kartu "Yang sudah saya pahami" ditempel di bawahnya,
   * bukan di ujung aliran setelah SETIAP giliran (audit UX 2026-10-08: kartu ±420 px muncul lagi
   * di bawah jawaban produk/perusahaan dan mendesak percakapan di ponsel).
   */
  readonly understood?: boolean;
}

export function ChatWorkspace() {
  const COPY = useChatCopy();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [state, setState] = useState<RequirementState | null>(null);
  const [stages, setStages] = useState<Readonly<Partial<Record<AnalysisStage, StageStatus>>>>({});
  const [error, setError] = useState<string | null>(null);
  const [answerMode, setAnswerMode] = useAnswerMode();
  /** Analisis gagal karena sesi akun berakhir (401 setelah pemulihan otomatis gagal). */
  const [sessionEnded, setSessionEnded] = useState(false);
  // Prototipe: panel tertutup secara bawaan di setiap lebar; rail 44px yang membukanya.
  const [panelOpen, setPanelOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [reopened, setReopened] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  // Mode "Ubah" panel: nilai sementara per field sampai "Selesai" dikirim sekaligus.
  const [editing, setEditing] = useState(false);
  const [composerFocus, setComposerFocus] = useState(0);
  const [edits, setEdits] = useState<Readonly<Record<string, string>>>({});
  const [editStatus, setEditStatus] = useState<'idle' | 'saving' | 'failed'>('idle');
  const narrow = useMediaQuery(NARROW_QUERY);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const { locale } = useLocale();
  const [handoffState, setHandoffState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const [toastOn, setToastOn] = useState(false);
  /** Register-gate (P8-09): tamu menekan aksi khusus akun — tawarkan daftar/masuk di tempat. */
  const [gate, setGate] = useState(false);
  const resumeHandled = useRef(false);
  /** Id percakapan yang baru dihapus — selama notifikasi "Urungkan" tampil. */
  const [removed, setRemoved] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sleepy, setSleepy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [openProduct, setOpenProduct] = useState<DrawerSelection | null>(null);
  const [solution, setSolution] = useState<Recommendation | null>(null);
  /** Prototipe `screen`: solusi adalah LAYAR sendiri yang menggantikan aliran chat. */
  const [screen, setScreen] = useState<'chat' | 'solution'>('chat');
  const [solutionTab, setSolutionTab] = useState<SolutionTab>('ringkasan');
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
    return () => {
      cancelled = true;
    };
  }, []);

  // Menjadi sempit menutup panel (prototipe); overlay tidak boleh tiba-tiba menutupi isi.
  useEffect(() => {
    if (narrow) setPanelOpen(false);
  }, [narrow]);

  /**
   * Panel kebutuhan/solusi: Escape menutupnya dan fokus kembali ke tombol yang membukanya. Di
   * ponsel panel menutup layar penuh, dan satu-satunya jalan keluar dulu tombol "»" 28 px tanpa
   * label yang jelas (audit UX 2026-10-08).
   */
  const panelTrigger = useRef<HTMLElement | null>(null);
  const panelCloseRef = useRef<HTMLButtonElement>(null);
  const openPanel = useCallback((): void => {
    panelTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPanelOpen(true);
  }, []);
  const closePanel = useCallback((): void => {
    setPanelOpen(false);
    panelTrigger.current?.focus();
  }, []);
  useEffect(() => {
    // Hanya panel overlay (layar sempit): di desktop panel menempel dan Escape milik dialog lain.
    if (!panelOpen || !narrow) return;
    panelCloseRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, narrow, closePanel]);

  // Drawer sidebar (layar sempit): Escape menutup; lebar yang membesar menutupnya juga.
  useEffect(() => {
    if (!narrow) setMenuOpen(false);
  }, [narrow]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const refreshHistory = useCallback(() => {
    if (history.kind === 'guest') return;
    void fetchHistory().then((result) => {
      if (result.kind === 'ok') setHistory({ kind: 'list', items: result.items });
    });
  }, [history.kind]);

  /**
   * Tempel ke bawah (pola ChatGPT/Claude): selama pengguna berada dekat dasar, aliran mengikuti
   * isi yang tumbuh — termasuk teks yang diungkap bertahap, yang tidak mengubah `turns`. Dulu gulir
   * hanya terjadi saat `turns` berubah, sehingga jawaban baru tumbuh di bawah layar sementara
   * layar diam di jawaban lama (audit UX 2026-10-08). Pengguna yang sedang menggulir ke atas
   * tidak ditarik paksa; ia mendapat tombol "pesan baru".
   */
  const stickRef = useRef(true);
  const [newBelow, setNewBelow] = useState(false);
  const scrollToBottom = useCallback(
    (smooth: boolean) => {
      const el = streamRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reducedMotion ? 'smooth' : 'auto' });
      stickRef.current = true;
      setNewBelow(false);
    },
    [reducedMotion],
  );
  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const onScroll = (): void => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD_PX;
      stickRef.current = near;
      if (near) setNewBelow(false);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight;
      else setNewBelow(true);
    });
    // Mengamati setiap anak aliran: tinggi `.stream` sendiri tetap (ia yang menggulir).
    const observeChildren = (): void => {
      for (const child of Array.from(el.children)) observer.observe(child);
    };
    observeChildren();
    const mutations = new MutationObserver(observeChildren);
    mutations.observe(el, { childList: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
      mutations.disconnect();
    };
  }, [screen, turns.length > 0]);
  // Pesan pengguna sendiri selalu dibawa ke tampilan, di mana pun posisi gulirnya.
  const lastRole = turns.at(-1)?.role;
  useEffect(() => {
    if (lastRole === 'user') scrollToBottom(true);
  }, [turns.length, lastRole, scrollToBottom]);
  useEffect(() => {
    if (stickRef.current) streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight });
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
      // Lanjutan dari layar solusi ("LANJUTKAN PERCAKAPAN") kembali ke aliran chat.
      setScreen('chat');

      // Percakapan dibuat SAAT pesan pertama, bukan saat halaman dibuka — kalau tidak,
      // setiap kunjungan meninggalkan "Konsultasi baru" kosong di riwayat.
      let id = conversationId;
      if (id === null) {
        try {
          id = (await createConversation(locale)).id;
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
      let understood = false;

      const apply = (event: AssistantStreamEvent): void => {
        switch (event.type) {
          case 'requirement.updated':
            understood = true;
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
        await sendMessage(activeId, text, apply, undefined, answerMode);
      } catch {
        setError(COPY.llmUnavailable);
      } finally {
        if (assistantText !== '' || assistantCards.length > 0) {
          setTurns((previous) => [
            ...previous,
            {
              id: assistantId,
              role: 'assistant',
              text: assistantText,
              cards: assistantCards,
              fresh: true,
              understood,
            },
          ]);
        } else {
          // Giliran berakhir tanpa teks maupun kartu (tahap gagal di server): jangan diam —
          // layar kosong terbaca sebagai rusak (laporan pemilik 2026-10-07).
          setError((current) => current ?? COPY.emptyReply);
        }
        setSending(false);
        // Judulnya baru ada setelah pesan pertama — muat ulang supaya riwayat ikut.
        refreshHistory();
      }
    },
    [conversationId, refreshHistory, sending, locale, COPY],
  );

  const submit = useCallback(() => submitText(draft), [draft, submitText]);

  /**
   * "Lampirkan denah" (P13-06): percakapan dibuat bila belum ada, berkas dikirim, lalu gelembung
   * pengguna ("Denah terlampir: …") dan balasannya — keduanya sudah tersimpan di server.
   */
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const attachFile = useCallback(
    async (file: File) => {
      if (uploading || sending) return;
      setError(null);
      let id = conversationId;
      if (id === null) {
        try {
          id = (await createConversation(locale)).id;
          setConversationId(id);
        } catch {
          setError(COPY.llmUnavailable);
          return;
        }
      }
      setUploading(true);
      const result = await uploadPlan(id, file);
      setUploading(false);
      if (result.kind === 'rejected') {
        setError(result.message);
        return;
      }
      if (result.kind === 'error') {
        setError(COPY.uploadFailed);
        return;
      }
      setTurns((previous) => [
        ...previous,
        { id: `u-${previous.length}`, role: 'user', text: result.userText, cards: [] },
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: result.replyText,
          cards: [],
          fresh: true,
        },
      ]);
      refreshHistory();
    },
    [conversationId, refreshHistory, sending, uploading, locale, COPY],
  );

  /**
   * Jawaban kartu klarifikasi — SEMUA pertanyaan dijawab dulu, dikirim sekali, tanpa LLM
   * (keputusan pemilik 2026-10-06). Server mengembalikan state baru, ringkasan jawaban
   * sebagai gelembung pengguna, dan kartu lanjutan (klarifikasi lagi / CTA / kebijakan).
   */
  const submitAnswers = useCallback(
    async (answers: ReadonlyArray<{ readonly id: string; readonly option: string }>) => {
      if (!conversationId || sending) return;
      setSending(true);
      setError(null);
      const result = await submitClarification(conversationId, answers);
      setSending(false);
      if (!result) {
        setError(COPY.clarifyFailed);
        return;
      }
      setState(result.state);
      setActiveTitle(
        COPY.titleFor(
          result.state.building.type.value as string | null,
          result.state.building.floors.value as number | null,
        ),
      );
      setTurns((previous) => [
        ...previous,
        { id: `u-${previous.length}`, role: 'user', text: result.userText, cards: [] },
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: result.text ?? '',
          cards: result.cards ?? (result.card ? [result.card] : []),
          fresh: true,
          understood: true,
        },
      ]);
    },
    [conversationId, sending, COPY],
  );

  /** "+ Konsultasi Baru" — kembali ke sambutan dengan percakapan baru (prototipe `reset`). */
  const reset = useCallback(() => {
    setTurns([]);
    setDraft('');
    setState(null);
    setStages({});
    setError(null);
    setSolution(null);
    setScreen('chat');
    setSaveState('idle');
    setGate(false);
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
          setScreen('chat');
          setStages({});
          setError(null);
          setSaveState(item.status === 'SAVED' ? 'saved' : 'idle');
        },
      );
    },
    [conversationId],
  );

  /**
   * Kembali dari daftar/masuk (P8-09): `?c=…&then=save` membuka percakapan yang SAMA — sudah
   * dipindahkan ke akun oleh server (G-1) — lalu meneruskan aksi yang tadi ditekan. Menunggu
   * riwayat akun termuat, karena hanya percakapan milik akun itu yang boleh dibuka.
   */
  useEffect(() => {
    if (resumeHandled.current || history.kind !== 'list') return;
    const target = parseResume(window.location.search);
    if (target === null) return;
    resumeHandled.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    const item = history.items.find((i) => i.id === target.conversationId);
    if (item === undefined) return;
    if (target.then !== 'save' || item.status === 'SAVED') {
      openHistory(item);
      return;
    }
    void saveConversation(item.id).then((result) => {
      openHistory(result === 'saved' ? { ...item, status: 'SAVED' } : item);
      if (result === 'saved') setToastOn(true);
    });
  }, [history, openHistory]);

  /**
   * Hapus dari riwayat (soft delete, seperti ChatGPT): baris hilang seketika, lalu notifikasi
   * "Percakapan dihapus · Urungkan" beberapa detik. Datanya tidak hilang di server, jadi
   * "Urungkan" cukup mengembalikannya. Menghapus percakapan yang sedang dibuka kembali ke
   * sambutan.
   */
  const removeConversation = useCallback(
    (item: { id: string; title: string | null }) => {
      if (history.kind !== 'list') return;
      const previous = history.items;
      setHistory({ kind: 'list', items: previous.filter((i) => i.id !== item.id) });
      if (item.id === conversationId) reset();
      void deleteConversation(item.id).then((ok) => {
        if (!ok) {
          setHistory({ kind: 'list', items: previous });
          setError(COPY.deleteFailed);
          return;
        }
        if (undoTimer.current !== null) clearTimeout(undoTimer.current);
        setRemoved(item.id);
        undoTimer.current = setTimeout(() => setRemoved(null), UNDO_MS);
      });
    },
    [COPY, conversationId, history, reset],
  );

  const undoRemove = useCallback(() => {
    if (removed === null) return;
    if (undoTimer.current !== null) clearTimeout(undoTimer.current);
    setRemoved(null);
    void restoreConversation(removed).then(() => refreshHistory());
  }, [refreshHistory, removed]);

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
  /**
   * `keepTab`: analisis ulang setelah edit panel tetap di tab yang sedang dibuka — dulu selalu
   * kembali ke Ringkasan, sehingga perubahan kuantitas di Estimasi Material atau Skema tidak
   * pernah terlihat (laporan pemilik 2026-10-08: "Ubah" terasa tidak berefek).
   */
  const startAnalysis = useCallback(
    (keepTab: boolean) => {
      if (!conversationId || analyzing) return;
      setAnalyzing(true);
      // "Memahami kebutuhan" sudah selesai di giliran chat — `/analyze` tidak memancarkannya
      // lagi. Tanpa ini tahap pertama tetap kosong, judul tak pernah "Solusi siap!", dan bar
      // berhenti di 80% (laporan pemilik 2026-10-06).
      setStages({ UNDERSTANDING: 'done' });
      setError(null);
      setSessionEnded(false);

      void runAnalysis(conversationId, (event) => {
        if (event.type === 'stage') {
          setStages((previous) => ({ ...previous, [event.stage]: event.status }));
        } else if (event.type === 'error') {
          setError(COPY.llmUnavailable);
        }
      })
        .then(async (recommendationId) => {
          if (!recommendationId) {
            setStages(markFailed);
            return;
          }
          const recommendation = await fetchRecommendation(recommendationId);
          // "Solusi siap!" sempat terlihat sebentar, lalu overlay menutup dan solusi tampil.
          await new Promise((resolve) => setTimeout(resolve, SOLUTION_READY_HOLD_MS));
          setSolution(recommendation);
          setStages({});
          // Prototipe: overlay menutup → `screen: 'solution'`, tab Ringkasan.
          if (!keepTab) setSolutionTab('ringkasan');
          setScreen('solution');
        })
        .catch((failure: unknown) => {
          setSessionEnded(failure instanceof Error && failure.message === 'analyze 401');
          setError(COPY.llmUnavailable);
          setStages(markFailed);
        })
        .finally(() => setAnalyzing(false));
    },
    [analyzing, conversationId],
  );
  const analyze = useCallback(() => startAnalysis(false), [startAnalysis]);

  /**
   * "Simpan hasil konsultasi". Digerbang `SAVE_SOLUTION` di API: tamu menerima 403 dan
   * tombolnya tetap tidak berubah — UI tidak berpura-pura berhasil.
   */
  const save = useCallback(() => {
    if (!conversationId || saveState === 'saved') return;
    void saveConversation(conversationId).then((result) => {
      if (result === 'needs-account') {
        setGate(true);
        return;
      }
      if (result !== 'saved') {
        setError(COPY.saveFailed);
        return;
      }
      setGate(false);
      setSaveState('saved');
      setToastOn(true);
    });
  }, [COPY, conversationId, saveState]);

  const rows = state ? requirementRows(state) : [];
  // Percakapan irigasi (OQ-47): panel memuat jawaban irigasi, hanya dibaca — bukan field
  // bangunan yang semuanya "Belum diisi".
  const useCase = state ? useCaseRows(state) : null;
  const useCaseFilled = useCase?.filter((row) => row.value !== null).length ?? 0;
  const filled = state?.completeness.filled ?? 0;
  // Kartu "Yang sudah saya pahami" dan rail menghitung hal yang sama: baris yang terisi — dulu
  // kartu memakai empat field inti sehingga tertulis 4 sementara rail 5 (verifikasi 2026-10-08).
  const rowsRead = rows.filter((row) => row.display !== 'Belum diisi').length;

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
    // Judul kepala halaman mengikuti kebutuhan yang baru diedit, sama seperti dari giliran chat.
    setActiveTitle(
      COPY.titleFor(
        next.building.type.value as string | null,
        next.building.floors.value as number | null,
      ),
    );
    setEditStatus('idle');
    setEditing(false);
    setEdits({});
    if (solution !== null) startAnalysis(true);
  }, [startAnalysis, conversationId, edits, rows, solution]);
  // Prototipe `readCount`: seluruh field yang terbaca (sampai 7), bukan hanya empat inti.
  /**
   * Kartu "Yang sudah saya pahami" — grid dengan badge hijau jumlah data — di bawah giliran TERAKHIR
   * yang memperbarui kebutuhan; riwayat yang dibuka kembali (tanpa penanda) menaruhnya di ujung.
   */
  const lastUnderstoodIndex = turns.reduce(
    (found, turn, index) => (turn.understood === true ? index : found),
    -1,
  );
  const understoodCard =
    state !== null && useCase === null && filled > 0 ? (
      <UnderstoodCard rows={rows} filled={rowsRead} />
    ) : useCase !== null && useCaseFilled > 0 ? (
      <UnderstoodCard
        rows={useCase
          .filter((row) => row.value !== null)
          .map((row) => ({ label: row.label, display: row.value ?? '' }))}
        filled={useCaseFilled}
      />
    ) : null;
  const readCount = useCase ? useCaseFilled : rowsRead;
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
      <div key={item.id} className={styles.historyRow}>
        <button
          type="button"
          className={itemClass}
          onClick={() => {
            setMenuOpen(false);
            openHistory(item);
          }}
        >
          <span className={styles.historyTitleText}>{item.title ?? COPY.titleFor(null, null)}</span>
          <span className={styles.historyMeta}>{historyDate(item.updatedAt)}</span>
        </button>
        <DeleteButton
          label={COPY.deleteConversation(item.title ?? COPY.titleFor(null, null))}
          onClick={() => removeConversation(item)}
        />
      </div>
    ));

  const footerAvatar = (
    <span className={styles.footerAvatar} aria-hidden="true">
      {user ? initialsOf(user.name) : 'T'}
    </span>
  );

  return (
    <div className={styles.shell}>
      {removed !== null && (
        <div className={styles.undoToast} role="status">
          <span>{COPY.deleted}</span>
          <button type="button" className={styles.undoButton} onClick={undoRemove}>
            {COPY.undo}
          </button>
        </div>
      )}
      {/* Sidebar 236px ATAU rail 60px — tidak pernah keduanya (prototipe `navCollapsed`).
          Di layar sempit sidebar yang SAMA menjadi drawer dari kiri (keputusan pemilik 2026-10-07:
          seperti ChatGPT/Claude di ponsel, bukan dropdown) — OQ-51, belum didesain. */}
      {narrow && menuOpen && (
        <div
          className={styles.drawerBackdrop}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      {(narrow ? menuOpen : !navCollapsed) && (
        <aside
          className={[styles.sidebar, narrow ? styles.sidebarDrawer : ''].join(' ')}
          role={narrow ? 'dialog' : undefined}
          aria-modal={narrow ? true : undefined}
          aria-label={narrow ? COPY.menuTitle : undefined}
        >
          <div className={styles.brandRow}>
            <SnoutyAvatar mood="idle" size={28} />
            <div className={styles.brandText}>
              <div className={styles.brandName}>{COPY.brand.name}</div>
              <div className={styles.brandKicker}>{COPY.brand.kicker}</div>
            </div>
            <button
              type="button"
              className={styles.navToggle}
              onClick={() => (narrow ? setMenuOpen(false) : setNavCollapsed(true))}
              title={narrow ? COPY.closeDrawer : COPY.collapseSidebar}
              aria-label={narrow ? COPY.closeDrawer : COPY.collapseSidebar}
              autoFocus={narrow}
            >
              {narrow ? '×' : '«'}
            </button>
          </div>

          <button
            type="button"
            className={styles.newButton}
            onClick={() => {
              setMenuOpen(false);
              reset();
            }}
          >
            <span className={styles.newPlus}>+</span>
            <span>{COPY.newConversation}</span>
          </button>

          <div className={styles.sidebarGroup}>
            <div className={styles.sidebarSection}>{COPY.historyTitle}</div>

            {/* Percakapan aktif: blok merah lembut + garis kiri merek, status mono merah. */}
            {inConversation && (
              <div className={styles.historyRow}>
                <div className={styles.historyActive} aria-current="true">
                  <span className={styles.historyActiveTitle}>
                    {activeTitle ?? COPY.titleFor(null, null)}
                  </span>
                  <span className={styles.historyActiveStatus}>{activeStatus}</span>
                </div>
                {/* Hanya akun yang punya riwayat; percakapan tamu tidak tercantum di mana pun. */}
                {history.kind === 'list' && conversationId !== null && (
                  <DeleteButton
                    label={COPY.deleteConversation(activeTitle ?? COPY.titleFor(null, null))}
                    onClick={() => removeConversation({ id: conversationId, title: activeTitle })}
                  />
                )}
              </div>
            )}

            {history.kind === 'guest' && <p className={styles.historyGuest}>{COPY.historyGuest}</p>}
            {history.kind === 'list' && otherHistory.length === 0 && !inConversation && (
              <p className={styles.historyGuest}>{COPY.historyEmpty}</p>
            )}
            {historyList(styles.historyItem!)}
          </div>

          {/* Tautan "Solusi Tersimpan" dan "Pengetahuan Produk" dari prototipe dihapus: tanpa
              layar di baliknya, tautan mati hanya menjanjikan yang tidak ada (keputusan pemilik
              2026-10-07). Kembali bila layarnya didesain. */}
          <div className={styles.sidebarLinks}>
            {/* Pengalih tema dan bahasa sebagai baris menu — penempatannya belum didesain; minimal. */}
            <ThemeToggle className={styles['sidebarLinkButton'] ?? ''} />
            <LocaleToggle className={styles['sidebarLinkButton'] ?? ''} />
          </div>

          <div className={styles.sidebarFooter}>
            {/* Pengguna masuk: kaki sidebar membuka pop-up akun (OQ-53, pemilik: pop-up, bukan halaman). */}
            {user ? (
              <button
                type="button"
                className={styles.footerLink}
                onClick={() => setAccountOpen(true)}
                title={COPY.footer.account}
                aria-label={COPY.footer.account}
              >
                {footerAvatar}
              </button>
            ) : (
              footerAvatar
            )}
            <div className={styles.footerText}>
              {user ? (
                <button
                  type="button"
                  className={styles.footerNameLink}
                  onClick={() => setAccountOpen(true)}
                >
                  <span className={styles.footerName}>{user.name}</span>
                </button>
              ) : (
                <span className={styles.footerName}>{COPY.footer.guestName}</span>
              )}
              {user ? (
                <span className={styles.footerRole}>
                  {COPY.footer.role} ·{' '}
                  <button
                    type="button"
                    className={styles.footerRoleButton}
                    onClick={() => setAccountOpen(true)}
                  >
                    {COPY.footer.account}
                  </button>
                </span>
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
          <span className={styles.railBottom}>
            <ThemeToggle compact />
            <LocaleToggle compact className={styles['railToggle'] ?? ''} />
            {footerAvatar}
          </span>
        </nav>
      )}

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {/* Sempit (<1080): sidebar hilang, "+ Baru" dan menu "Riwayat" pindah ke header. */}
            {narrow && (
              <>
                {/* "+ Konsultasi Baru" hidup di dalam drawer (keputusan pemilik 2026-10-07: tombol
                    plus bukan di navbar); header sempit hanya pembuka drawer, judul, dan kebutuhan. */}
                {/* Membuka drawer sidebar (bukan dropdown) — di ponsel ikon hamburger. */}
                <button
                  type="button"
                  className={styles.headerMenuButton}
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-label={COPY.menu}
                >
                  {mobile ? '☰' : COPY.menu}
                </button>
              </>
            )}
            <span className={styles.headerTitle}>
              {inConversation ? (activeTitle ?? COPY.headerTitle) : COPY.headerWelcomeTitle}
            </span>
            {/* Badge mono berbingkai "SOLUSI SIAP" setelah solusi tersusun. Badge "LANGKAH n DARI 4"
                dari prototipe dihapus (pemilik, 2026-10-07): hitungan langkah tidak berarti bagi
                pengguna — meter kelengkapan di panel sudah menjawab "sudah sejauh mana". */}
            {!mobile && inConversation && solution !== null && (
              <span className={styles.headerStatus}>{COPY.solutionReady}</span>
            )}
          </div>
          <div className={styles.headerActions}>
            {/* Sempit: sidebar (dan pengalih tema di dalamnya) hilang — tombolnya pindah ke header. */}
            {/* Di ponsel, pengalih tema dan bahasa cukup di drawer: header 390 px sudah memuat
                + ☰ judul dan "Kebutuhan (n)" — lima kontrol membuat judul terpotong dan bertumpuk
                (audit tampilan ponsel 2026-10-07). Di layar sempit non-ponsel tetap di header. */}
            {narrow && !mobile && <ThemeToggle compact />}
            {narrow && !mobile && (
              <LocaleToggle compact className={styles['headerMenuButton'] ?? ''} />
            )}
            {/* Ponsel (board 13a): "Kebutuhan (n)" membuka panel sebagai lembar. */}
            {mobile && inConversation && (
              <button type="button" className={styles.headerNeeds} onClick={openPanel}>
                {COPY.mobileNeeds(readCount)}
              </button>
            )}
            {!mobile && solution !== null && screen === 'chat' && (
              <button
                type="button"
                className={styles.tabAction}
                onClick={() => setScreen('solution')}
              >
                {COPY.viewSolution}
              </button>
            )}
            {!mobile && solution !== null && (
              <button
                type="button"
                className={styles.headerPrimary}
                onClick={() => setReportOpen(true)}
              >
                {reportCopy(locale).open}
              </button>
            )}
          </div>
        </header>
        {/*
          Ponsel: "Lihat solusi" dan "Buat laporan" di baris tipis sendiri. Di header 375–390 px,
          keduanya memakan seluruh lebar dan judul ambruk menjadi "R…" (audit UX 2026-10-08).
        */}
        {mobile && inConversation && solution !== null && (
          <div className={styles.mobileActions}>
            {screen === 'chat' && (
              <button
                type="button"
                className={styles.tabAction}
                onClick={() => setScreen('solution')}
              >
                {COPY.viewSolution}
              </button>
            )}
            <button
              type="button"
              className={styles.headerPrimary}
              onClick={() => setReportOpen(true)}
            >
              {reportCopy(locale).open}
            </button>
          </div>
        )}

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
                <ComposerField
                  className={styles.composerCardInput ?? ''}
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => void submit()}
                  placeholder={COPY.composerPlaceholder}
                  ariaLabel={COPY.composerPlaceholder}
                />
                <div className={styles.composerCardFoot}>
                  {/* "Lampirkan denah" (P13-06): PDF, PNG, JPG, WEBP — diperiksa ulang di server. */}
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) void attachFile(file);
                    }}
                  />
                  <button
                    type="button"
                    className={styles.attachButton}
                    disabled={uploading || sending}
                    onClick={() => fileInput.current?.click()}
                  >
                    <span className={styles.iconSquare} />
                    {uploading ? COPY.uploading : COPY.attachPlan}
                  </button>
                  <AnswerModeSwitch mode={answerMode} onChange={setAnswerMode} />
                  <button
                    type="button"
                    className={styles.sendButton}
                    onClick={() => void submit()}
                    disabled={draft.trim() === '' || sending}
                    aria-busy={sending}
                  >
                    {COPY.send}
                  </button>
                </div>
              </div>
              {/* Galat di layar sambutan (mis. denah ditolak) — aliran chat belum ada untuk menampungnya. */}
              {error !== null && (
                <div className={styles.errorCard} role="alert">
                  {error}
                </div>
              )}
            </div>
          </div>
        ) : screen === 'chat' ? (
          <div className={styles.stream} ref={streamRef} aria-live="polite">
            {turns.map((turn, turnIndex) =>
              turn.role === 'user' ? (
                <div key={turn.id} className={styles.userRow}>
                  <div className={styles.userBubble}>{turn.text}</div>
                </div>
              ) : (
                <Fragment key={turn.id}>
                  <AssistantTurn
                    turn={turn}
                    animate={turn.fresh === true && !reducedMotion}
                    cardsActive={turnIndex === turns.length - 1 && !sending}
                    onAnswers={submitAnswers}
                    onHandoff={handoff}
                    handoffState={handoffState}
                    onSave={save}
                    saveState={saveState}
                    onAnalyze={analyze}
                    analyzing={analyzing}
                    onOpenProduct={(product) => setOpenProduct({ productId: product.productId })}
                  />
                  {turnIndex === lastUnderstoodIndex && understoodCard}
                </Fragment>
              ),
            )}
            {lastUnderstoodIndex === -1 && understoodCard}

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

            {Object.keys(stages).length > 0 && (
              <AnalysisOverlay
                stages={stages}
                sessionEnded={sessionEnded}
                onRetry={analyze}
                onBack={() => setStages({})}
              />
            )}

            {openProduct && (
              <ProductDrawer selection={openProduct} onClose={() => setOpenProduct(null)} />
            )}

            {accountOpen && (
              <AccountModal
                onClose={() => setAccountOpen(false)}
                onProfileChange={(p) => setUser({ name: p.name, tier: p.tier })}
              />
            )}

            {reportOpen && solution !== null && (
              <ReportModal
                recommendationId={solution.id}
                onClose={() => setReportOpen(false)}
                guest={user === null}
              />
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

            {gate && conversationId !== null && (
              <RegisterGate conversationId={conversationId} onDismiss={() => setGate(false)} />
            )}

            {error !== null && (
              <div className={styles.errorCard} role="status">
                {error}
              </div>
            )}
          </div>
        ) : null}

        {/*
          Layar solusi (prototipe `isSolution`, layar 06): MENGGANTIKAN aliran chat. Tab di atas,
          isi menggulir, tanpa composer. Sebelumnya SolutionView ditempel di dalam stream dan
          menciut jadi strip 90px (laporan pemilik 2026-10-06: "hasilnya nggak bisa diliat").
        */}
        {inConversation && screen === 'solution' && solution !== null && (
          <div className={styles.solutionScreen}>
            <div className={styles.solutionTabs}>
              <button type="button" className={styles.tabBack} onClick={() => setScreen('chat')}>
                {COPY.backToChat}
              </button>
              <div className={styles.tabList} role="tablist" aria-label={COPY.solutionReady}>
                {COPY.solutionTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={solutionTab === t.id}
                    className={[styles.tab, solutionTab === t.id ? styles.tabOn : ''].join(' ')}
                    onClick={(event) => {
                      setSolutionTab(t.id as SolutionTab);
                      // Tab di ponsel menggulir ke samping: yang dipilih selalu terlihat utuh.
                      event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className={styles.solutionTabActions}>
                <button
                  type="button"
                  className={styles.tabAction}
                  onClick={save}
                  disabled={saveState === 'saved'}
                >
                  {saveState === 'saved' ? COPY.saved : COPY.saveSolution}
                </button>
              </div>
            </div>
            {gate && conversationId !== null && (
              <RegisterGate conversationId={conversationId} onDismiss={() => setGate(false)} />
            )}
            <SolutionView
              recommendation={solution}
              tab={solutionTab}
              // Asumsi angka kasus teknis diganti di tempat, lalu langsung dihitung ulang di tab yang
              // sama (pemilik 2026-10-09: "kalau gw perbaiki asumsi ini SNOUTY ngitung kembali?").
              onChangeAssumption={async (assumptionId, value) => {
                if (!conversationId) return COPY.llmUnavailable;
                const problem = await overrideAssumption(conversationId, assumptionId, value);
                if (problem !== null) return problem;
                startAnalysis(true);
                return null;
              }}
              // "Perbaiki asumsi ini" → panel terbuka dalam mode Ubah (prototipe). Kasus teknis/irigasi
              // tidak punya editor panel — nilainya diubah lewat chat — jadi kembali ke chat dengan
              // panel terbuka dan kolom ketik terfokus (laporan pemilik 2026-10-08: tombolnya diam).
              onFixAssumption={() => {
                openPanel();
                if (useCase !== null) {
                  setScreen('chat');
                  setComposerFocus((n) => n + 1);
                  return;
                }
                setEditing(true);
              }}
            />
          </div>
        )}

        {inConversation && screen === 'chat' && (
          <div className={styles.composerWrap}>
            {newBelow && (
              <button
                type="button"
                className={styles.newBelow}
                onClick={() => scrollToBottom(true)}
              >
                {COPY.newMessagesBelow}
              </button>
            )}
            <AnswerModeSwitch mode={answerMode} onChange={setAnswerMode} />
            {/* Ponsel: bidang berbentuk pil + tombol kirim bulat 40px (board 13a). */}
            <div className={[styles.composerCard, mobile ? styles.composerPill : ''].join(' ')}>
              <ComposerField
                className={styles.composerCardInput ?? ''}
                value={draft}
                focusToken={composerFocus}
                onChange={setDraft}
                onSubmit={() => void submit()}
                placeholder={mobile ? COPY.composerPlaceholderMobile : COPY.composerPlaceholderChat}
                ariaLabel={COPY.composerPlaceholderChat}
              />
              <button
                type="button"
                className={[styles.sendButton, mobile ? styles.sendRound : ''].join(' ')}
                onClick={() => void submit()}
                disabled={draft.trim() === '' || sending}
                aria-busy={sending}
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
        <aside className={styles.panelRail} onClick={openPanel} title={COPY.expandPanel}>
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
        <div className={styles.scrim} onClick={closePanel} aria-hidden="true" />
      )}

      {inConversation && panelOpen && (
        <aside
          className={[styles.panel, narrow ? styles.panelOverlay : ''].join(' ')}
          aria-label={COPY.panelTitle}
        >
          <div className={styles.panelHead}>
            <span>{COPY.panelTitle}</span>
            <button
              ref={panelCloseRef}
              type="button"
              className={[styles.panelToggle, narrow ? styles.panelClose : ''].join(' ')}
              onClick={closePanel}
              title={narrow ? COPY.closePanel : COPY.collapsePanel}
              aria-label={narrow ? COPY.closePanel : COPY.collapsePanel}
            >
              {narrow ? '×' : '»'}
            </button>
          </div>
          <div className={styles.panelBody}>
            <section className={styles.panelSection}>
              <div className={styles.panelKickerRow}>
                <div className={styles.panelKicker}>{COPY.requirementsLabel}</div>
                {/* "Ubah" ↔ "Selesai" — edit inline nol LLM (prototipe `editing`). */}
                {rows.length > 0 && useCase === null && (
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
              {useCase?.map((row) => (
                <div
                  key={row.field}
                  className={[
                    styles.reqRow,
                    row.value === null && row.required ? styles.reqRowMissing : '',
                  ].join(' ')}
                >
                  <span className={styles.reqLabel}>{row.label}</span>
                  <span
                    className={[
                      styles.reqValue,
                      row.value === null ? styles.reqValueMissing : '',
                    ].join(' ')}
                  >
                    {row.value ?? MISSING}
                  </span>
                </div>
              ))}
              {useCase === null &&
                rows.map((row) => (
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
              <p className={styles.meterNote}>{completenessNote(filled, COPY)}</p>
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
function completenessNote(filled: number, copy: ReturnType<typeof chatCopy>): string {
  const missing = 4 - filled;
  return missing <= 0 ? copy.meterNote.complete : copy.meterNote.remaining(missing);
}

/** Tombol hapus di baris riwayat — muncul saat diarahkan; di layar sentuh selalu terlihat. */
function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={styles.historyDelete}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * Register-gate (P8-09, OQ-27 usulan default; **belum didesain**, OQ-21): panel di dalam
 * percakapan — bukan modal — yang menjelaskan apa yang dibuka akun lalu menawarkan daftar/masuk.
 * Tautannya membawa percakapan ini, jadi setelah masuk pengguna kembali ke kasus yang sama.
 */
function RegisterGate({
  conversationId,
  onDismiss,
}: {
  conversationId: string;
  onDismiss: () => void;
}) {
  const COPY = useChatCopy();
  return (
    <div className={styles.gateCard} role="region" aria-label={COPY.gate.title}>
      <div className={styles.gateTitle}>{COPY.gate.title}</div>
      <p className={styles.gateBody}>{COPY.gate.body}</p>
      <div className={styles.gateActions}>
        <a className={styles.ctaButton} href={gateHref('register', conversationId, 'save')}>
          {COPY.gate.register}
        </a>
        <a className={styles.chip} href={gateHref('login', conversationId, 'save')}>
          {COPY.gate.login}
        </a>
        <button type="button" className={styles.gateLater} onClick={onDismiss}>
          {COPY.gate.later}
        </button>
      </div>
    </div>
  );
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
  const COPY = useChatCopy();
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

/** Tahap yang sedang berjalan (atau yang pertama belum selesai) ditandai gagal. */
function markFailed(
  previous: Readonly<Partial<Record<AnalysisStage, StageStatus>>>,
): Readonly<Partial<Record<AnalysisStage, StageStatus>>> {
  if (Object.values(previous).includes('failed')) return previous;
  const stage =
    STAGE_ORDER.find((s) => previous[s] === 'active') ??
    STAGE_ORDER.find((s) => previous[s] !== 'done') ??
    STAGE_ORDER[STAGE_ORDER.length - 1]!;
  return { ...previous, [stage]: 'failed' };
}

/**
 * Overlay analisis (prototipe "ANALYSIS OVERLAY"): dialog modal yang menutup ruang kerja
 * selama solusi disusun. Tidak ada tombol tutup dan Escape diabaikan — pengguna menunggu
 * hasilnya (keputusan pemilik 2026-10-06). Tombol hanya ada saat gagal: "Coba lagi" dan
 * "Kembali ke percakapan", persis prototipe. Fokus dipindahkan ke dialog saat terbuka.
 */
function AnalysisOverlay({
  stages,
  sessionEnded = false,
  onRetry,
  onBack,
}: {
  stages: Readonly<Partial<Record<AnalysisStage, StageStatus>>>;
  sessionEnded?: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  const COPY = useChatCopy();
  const { locale } = useLocale();
  const dialogRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, []);

  return (
    <div
      className={styles.analysisOverlay}
      onKeyDown={(event) => {
        // Tidak bisa ditutup dengan Escape selama berjalan; saat gagal pun lewat tombol.
        if (event.key === 'Escape') event.preventDefault();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.stageCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-title"
        aria-busy={phase === 'running'}
        tabIndex={-1}
      >
        <div className={styles.stageHead}>
          {/* Prototipe: think selama dua tahap pertama, lalu write; happy saat selesai, fail saat gagal. */}
          <Snouty
            mood={
              phase === 'failed'
                ? 'fail'
                : phase === 'done'
                  ? 'happy'
                  : done < 2
                    ? 'think'
                    : 'write'
            }
            size={84}
          />
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <h3 id="analysis-title" className={styles.stageTitle}>
          {COPY.analysis[phase].title}
        </h3>
        <p className={styles.stageSub} aria-live="polite">
          {phase === 'failed' && sessionEnded
            ? COPY.analysis.sessionExpired
            : COPY.analysis[phase].sub}
        </p>
        {phase === 'failed' && (
          <div className={styles.stageActions}>
            <button type="button" className={styles.ctaButton} onClick={onRetry}>
              {COPY.analysisRetry}
            </button>
            <button type="button" className={styles.stageBack} onClick={onBack}>
              {COPY.analysisBack}
            </button>
          </div>
        )}
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
                {stageLabel(stage, locale)}
              </span>
            </div>
          );
        })}
        <p className={styles.stageFooter}>{COPY.analysisFooter}</p>
      </div>
    </div>
  );
}

/**
 * Kartu klarifikasi (layar 03): pertanyaan BERNOMOR, maksimum empat. Jawaban DITAMPUNG —
 * chip menandai pilihan, "Kirim jawaban" mengirim semuanya sekali (keputusan pemilik
 * 2026-10-06). Satu pertanyaan saja (bentuk tunggal prototipe) tetap langsung terkirim.
 * Kartu yang bukan giliran terakhir terkunci: tetap terbaca, tidak bisa diklik.
 */
function ClarificationCard({
  questions,
  active,
  onSubmit,
}: {
  questions: readonly ClarificationQuestion[];
  active: boolean;
  onSubmit: (answers: ReadonlyArray<{ readonly id: string; readonly option: string }>) => void;
}) {
  const COPY = useChatCopy();
  const [picked, setPicked] = useState<Readonly<Record<string, string>>>({});
  const single = questions.length === 1;
  const complete = questions.every((q) => picked[q.id] !== undefined);

  const choose = (question: ClarificationQuestion, option: string) => {
    if (!active) return;
    setPicked((previous) => ({ ...previous, [question.id]: option }));
    if (single) onSubmit([{ id: question.id, option }]);
  };
  const submit = () => {
    if (!active || !complete) return;
    onSubmit(questions.map((q) => ({ id: q.id, option: picked[q.id]! })));
  };
  const skip = () => {
    if (!active) return;
    setPicked(Object.fromEntries(questions.map((q) => [q.id, UNKNOWN_OPTION])));
    onSubmit(questions.map((q) => ({ id: q.id, option: UNKNOWN_OPTION })));
  };

  return (
    <div className={styles.clarificationCard}>
      <div className={styles.cardKicker}>{COPY.clarificationTitle}</div>
      {questions.map((question, index) => (
        <div key={question.id} className={styles.question}>
          <div className={styles.questionHead}>
            <span className={styles.questionNum}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.questionText}>{question.question}</span>
          </div>
          <div className={styles.chips} role="group" aria-label={question.question}>
            {[...question.options, ...(question.allowUnknown ? [UNKNOWN_OPTION] : [])].map(
              (option, optionIndex) => (
                <button
                  key={option}
                  type="button"
                  className={[
                    styles.chip,
                    picked[question.id] === option ? styles.chipSelected : '',
                  ].join(' ')}
                  aria-pressed={picked[question.id] === option}
                  disabled={!active}
                  onClick={() => choose(question, option)}
                >
                  {/* Nilai chip = protokol (label Indonesia kanonik); yang tampil label
                      bahasa percakapan dari API, "Belum tahu" dari copy bahasa aktif. */}
                  {option === UNKNOWN_OPTION
                    ? COPY.unknownOption
                    : (question.optionLabels?.[optionIndex] ?? option)}
                </button>
              ),
            )}
          </div>
        </div>
      ))}
      {!single && (
        <div className={styles.clarifyActions}>
          <button
            type="button"
            className={styles.ctaButton}
            disabled={!active || !complete}
            onClick={submit}
          >
            {COPY.sendAnswers}
          </button>
          {questions.length >= 3 && (
            <button type="button" className={styles.skipDefaults} disabled={!active} onClick={skip}>
              {COPY.skipToDefaults}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const UNKNOWN_OPTION = 'Belum tahu';

/**
 * Satu giliran asisten: teks diungkap bertahap (giliran baru, tanpa reduced-motion), kartu
 * masuk setelah teksnya selesai. Riwayat (`animate=false`) tampil utuh seketika.
 */
function AssistantTurn({
  turn,
  animate,
  cardsActive,
  ...cardProps
}: {
  turn: ChatTurn;
  animate: boolean;
  cardsActive: boolean;
  onAnswers: (answers: ReadonlyArray<{ readonly id: string; readonly option: string }>) => void;
  onHandoff: (reason: string) => void;
  handoffState: 'idle' | 'sending' | 'sent';
  onSave: () => void;
  saveState: 'idle' | 'saved';
  onAnalyze: () => void;
  analyzing: boolean;
  onOpenProduct: (product: ProductCardDto) => void;
}) {
  const { shown, done } = useRevealedText(turn.text, animate);
  return (
    <div className={styles.assistantRow}>
      <SnoutyAvatar mood={moodForCards(turn.cards)} size={30} />
      <div className={styles.assistantCol}>
        {turn.text !== '' && (
          <div className={styles.assistantBubble}>
            <AssistantMarkdown text={shown} />
          </div>
        )}
        {done &&
          turn.cards.map((card, index) => (
            <div key={index} className={animate ? styles.cardEnter : undefined}>
              <CardView card={card} active={cardsActive} {...cardProps} />
            </div>
          ))}
      </div>
    </div>
  );
}

function CardView({
  card,
  active,
  onAnswers,
  onHandoff,
  handoffState,
  onSave,
  saveState,
  onAnalyze,
  analyzing,
  onOpenProduct,
}: {
  card: AssistantCard;
  /** Kartu di giliran terakhir — satu-satunya yang masih bisa dijawab. */
  active: boolean;
  onAnswers: (answers: ReadonlyArray<{ readonly id: string; readonly option: string }>) => void;
  onHandoff: (reason: string) => void;
  handoffState: 'idle' | 'sending' | 'sent';
  onSave: () => void;
  saveState: 'idle' | 'saved';
  onAnalyze: () => void;
  analyzing: boolean;
  onOpenProduct: (product: ProductCardDto) => void;
}) {
  const COPY = useChatCopy();
  if (card.kind === 'product') {
    return <ProductLookupCards products={card.products} onOpen={onOpenProduct} />;
  }

  if (card.kind === 'clarification') {
    return <ClarificationCard questions={card.questions} active={active} onSubmit={onAnswers} />;
  }

  if (card.kind === 'cta' && card.action === 'CONTACT_TECHNICAL') {
    // Jawaban produk yang menawarkan tim teknis: satu tombol handoff — bukan "Data inti sudah
    // lengkap / Susun rekomendasi" yang tidak ada hubungannya (laporan pemilik 2026-10-06).
    return (
      <div className={styles.ctaCard}>
        <button
          type="button"
          className={styles.ctaButton}
          onClick={() => onHandoff(COPY.contactTechnicalReason)}
          disabled={handoffState !== 'idle'}
        >
          {handoffState === 'sent'
            ? COPY.unsupported.sent
            : handoffState === 'sending'
              ? COPY.unsupported.sending
              : COPY.unsupported.sendToTechnical}
        </button>
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

const ANSWER_MODE_KEY = 'snouty-answer-mode';

/** Mode jawaban, diingat per browser (kenyamanan per penampil; tanpa penyimpanan → hemat). */
function useAnswerMode(): [AnswerMode, (mode: AnswerMode) => void] {
  const [mode, setMode] = useState<AnswerMode>('hemat');
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ANSWER_MODE_KEY);
      if (saved === 'hemat' || saved === 'kualitas') setMode(saved);
    } catch {
      // Penyimpanan diblokir: tetap hemat.
    }
  }, []);
  const update = (next: AnswerMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(ANSWER_MODE_KEY, next);
    } catch {
      // Penyimpanan diblokir: pilihan berlaku untuk sesi ini saja.
    }
  };
  return [mode, update];
}

/** Saklar Hemat | Kualitas di kotak ketik. */
function AnswerModeSwitch({
  mode,
  onChange,
}: {
  mode: AnswerMode;
  onChange: (mode: AnswerMode) => void;
}) {
  const COPY = useChatCopy();
  return (
    <div className={styles.modeSwitch} role="group" aria-label={COPY.answerMode.label}>
      {(['hemat', 'kualitas'] as const).map((option) => (
        <button
          key={option}
          type="button"
          className={styles.modeOption}
          aria-pressed={mode === option}
          title={option === 'hemat' ? COPY.answerMode.hematHint : COPY.answerMode.kualitasHint}
          onClick={() => onChange(option)}
        >
          {COPY.answerMode[option]}
        </button>
      ))}
    </div>
  );
}
