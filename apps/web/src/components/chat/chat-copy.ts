/**
 * Teks layar konsultasi (layar 02), apa adanya dari desain — satu modul siap i18n.
 *
 * Kalimat batas rekomendasi TIDAK BOLEH diparafrase: ia membawa janji kebijakan
 * ("panduan perencanaan, bukan sertifikasi teknis"), bukan sekadar redaksi
 * (docs/DESIGN_IMPLEMENTATION.md §10).
 */

import { ANALYSIS_STAGE_LABELS, type AnalysisStage } from '@snouty/shared-types';
import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

export const CHAT_COPY = {
  brand: { name: 'SNOUTY', kicker: 'PRALON ASSISTANT' },
  newConversation: 'Konsultasi Baru',
  historyTitle: 'RIWAYAT',
  collapsePanel: 'Ciutkan panel',
  expandPanel: 'Buka panel kebutuhan & solusi',
  /** Tamu tidak melihat riwayat — ajakan, bukan daftar kosong. */
  historyGuest: 'Daftar akun untuk menyimpan dan membuka kembali konsultasi Anda.',
  historyEmpty: 'Belum ada konsultasi lain.',
  saveSolution: 'Simpan hasil konsultasi',
  saved: 'Tersimpan',
  /** Label aksesibel titik berpikir — tidak ada teksnya di prototipe. */
  thinking: 'SNOUTY sedang berpikir',
  toast: {
    title: 'Solusi tersimpan',
    sub: 'Terima kasih! Buka lagi kapan saja dari Riwayat.',
  },
  /** Judul dan sub overlay analisis prototipe, per keadaan. */
  analysis: {
    running: { title: 'Menyusun solusi Anda', sub: 'Biasanya selesai dalam beberapa detik.' },
    done: {
      title: 'Solusi siap!',
      sub: 'Membuka rekomendasi, produk, skema, dan estimasi material.',
    },
    failed: {
      title: 'Gagal menyusun rekomendasi',
      sub: 'Koneksi ke katalog Pralon terputus di tengah analisis. Kebutuhan Anda tetap tersimpan, jadi tidak perlu mengetik ulang.',
    },
  },
  /** Placeholder berbeda antara layar sambutan dan lanjutan percakapan — dari prototipe. */
  composerPlaceholder: 'Contoh: Saya bangun rumah 2 lantai, 3 kamar mandi, toren di atap…',
  composerPlaceholderChat: 'Tulis jawaban atau tambahan detail…',
  composerPlaceholderMobile: 'Tulis jawaban…',
  attachPlan: 'Lampirkan denah',

  /** Layar sambutan di dalam ruang konsultasi (prototipe, state `isWelcome`). */
  welcome: {
    /* Teks gelembung dari prototipe (`welcomeBubble`), bukan dari board. */
    bubble: 'Halo! Ceritakan rumahmu, biar aku hitung pipanya.',
    sleepBubble: 'Zzz… ketik saja, aku langsung bangun.',
    headline: 'Temukan solusi perpipaan yang tepat untuk kebutuhan Anda.',
    body: 'Ceritakan kebutuhan bangunan atau instalasi Anda. SNOUTY akan membantu menganalisis kebutuhan dan merekomendasikan solusi produk Pralon.',
  },

  headerTitle: 'Konsultasi',
  headerWelcomeTitle: 'Konsultasi Baru',
  // Badge versi katalog ("KATALOG PRALON · erp-…") dihapus 2026-10-06 atas keputusan pemilik:
  // label impor adalah urusan back-office, bukan teks untuk pengguna.
  /** Teks di bawah meter kelengkapan (salinan desain; dulu literal di komponen). */
  meterNote: {
    complete: 'Data inti sudah lengkap. Nilai yang tidak diberikan tetap ditandai sebagai asumsi.',
    remaining: (missing: number) =>
      `${missing} kelompok data lagi sebelum SNOUTY dapat menyusun rekomendasi.`,
  },
  solutionReady: 'SOLUSI SIAP',
  /** Judul percakapan aktif, diturunkan dari kebutuhan (prototipe `titleFrom`). */
  titleFor: (building: string | null, floors: number | null) => {
    if (building === 'industrial') return 'Pabrik — jalur air proses';
    if (building === 'boarding_house') return 'Rumah kos — instalasi air bersih';
    // Toko, kantor, masjid, sekolah: bangunan komersial ringan, bukan "Rumah" (laporan pemilik 2026-10-08).
    if (building === 'light_commercial')
      return floors !== null
        ? `Bangunan ${floors} lantai — konsultasi baru`
        : 'Bangunan komersial — konsultasi baru';
    if (floors !== null) return `Rumah ${floors} lantai — konsultasi baru`;
    return 'Konsultasi baru';
  },

  collapseSidebar: 'Ciutkan sidebar',
  expandSidebar: 'Buka sidebar',
  newShort: 'Baru',
  menu: 'Riwayat',
  menuTitle: 'RIWAYAT KONSULTASI',
  /** Tombol tutup drawer sidebar di layar sempit (OQ-51). */
  closeDrawer: 'Tutup menu',
  activeStatus: {
    inProgress: 'SEDANG BERLANGSUNG',
    ready: 'SOLUSI SIAP',
    reopened: 'DIBUKA KEMBALI',
  },
  footer: {
    guestName: 'Tamu',
    guestRole: 'Belum masuk',
    login: 'Masuk',
    register: 'Daftar',
    role: 'Pelanggan',
    account: 'Akun',
  },
  /** Belum ada endpoint berkas (`POST /uploads` baru kontrak) — chip tidak berpura-pura. */
  uploading: 'Mengirim denah…',
  uploadFailed: 'Denah belum terkirim. Coba lagi sebentar.',
  newMessagesBelow: 'Pesan baru ↓',
  closePanel: 'Tutup panel',
  analyzeCta: 'Susun rekomendasi',
  followUps: {
    title: 'LANJUTKAN PERCAKAPAN',
    items: (mainSize: string) => [
      'Kalau kamar mandi saya tambah satu?',
      `Kenapa pakai ukuran ${mainSize} di jalur utama?`,
      'Kalau torennya di lantai 3?',
      'Produknya tersedia ukuran apa saja?',
    ],
  },
  mobileNeeds: (n: number) => `Kebutuhan (${n})`,
  panelEdit: 'Ubah',
  panelDone: 'Selesai',
  panelSaving: 'Menyimpan…',
  panelEditFailed: 'Perubahan belum tersimpan. Coba lagi.',
  mobileSend: '→',

  /** Kartu "Yang sudah saya pahami" — grid 3 kolom, badge hijau jumlah data. */
  understood: {
    title: 'Yang sudah saya pahami',
    readCount: (n: number) => `${n} DATA TERBACA`,
  },

  /** Rail panel terciut: teks vertikal. */
  railLabel: 'KEBUTUHAN & SOLUSI',
  railUnit: 'DATA',
  send: 'Kirim',
  panelTitle: 'Panel Solusi',
  requirementsLabel: 'KEBUTUHAN ANDA',
  completenessLabel: 'KELENGKAPAN DATA',
  boundaryTitle: 'Batas rekomendasi',
  // Janji kebijakan — jangan diparafrase.
  boundaryBody:
    'Solusi ini panduan perencanaan, bukan sertifikasi teknis. Untuk pelaksanaan, rencana akhir sebaiknya diperiksa bersama instalatur atau tim teknis Pralon.',
  analysisFooter:
    'SNOUTY hanya mencocokkan dengan katalog Pralon. Nilai yang tidak tersedia ditandai sebagai estimasi.',
  llmUnavailable:
    'Pemahaman bahasa sedang tidak tersedia. Coba lagi sebentar — percakapan Anda tetap tersimpan.',
  /** Giliran berakhir tanpa teks maupun kartu (tahap gagal di server). */
  emptyReply:
    'Saya belum bisa membaca pesan itu. Coba tulis ulang dengan jumlah lantai, kamar mandi, dan sumber airnya.',
  emptyState: 'Ceritakan kebutuhan Anda seperti berbicara dengan konsultan. Tanpa istilah teknis.',

  /** Layar 08 — kriteria netral saat pertanyaan kompetitor ditolak dibandingkan. */
  criteriaTitle: 'KRITERIA YANG SEBAIKNYA DIPERIKSA',

  /** Layar 11 — validasi teknis / belum didukung. */
  /** Kartu produk dari jawaban pengetahuan produk — belum ada di desain (OQ-21). */
  productCards: {
    title: 'PRODUK PRALON TERKAIT',
    open: 'Lihat detail',
  },
  /** Alasan handoff dari kartu CTA jawaban produk (tombol "Kirim ke tim teknis Pralon"). */
  contactTechnicalReason: 'Pertanyaan produk Pralon dari percakapan',
  unsupported: {
    title: 'Kebutuhan ini membutuhkan pengecekan teknis lebih lanjut',
    capturedLabel: 'YANG SUDAH SAYA CATAT',
    sendToTechnical: 'Kirim ke tim teknis Pralon',
    sending: 'Mengirim…',
    sent: 'Sudah dikirim ke tim teknis',
    downloadSummary: 'Unduh ringkasan kebutuhan',
    slaNote: (hours: number) => `Tim teknis Pralon biasanya menanggapi dalam ${hours} jam kerja.`,
  },

  /** Layar 03 — kartu klarifikasi bernomor. */
  clarificationTitle: 'AGAR SAYA TIDAK MENEBAK',
  /** Label chip "belum tahu"; nilai yang dikirim ke API tetap 'Belum tahu' (protokol). */
  unknownOption: 'Belum tahu',
  skipToDefaults: 'Lewati dan gunakan asumsi standar',
  /** Layar solusi (prototipe `tabDefs`): tab menggantikan aliran chat. */
  solutionTabs: [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'produk', label: 'Produk Pralon' },
    { id: 'skema', label: 'Skema' },
    { id: 'material', label: 'Estimasi Material' },
  ] as const,
  /** Bolak-balik chat ↔ solusi — bukan dari prototipe (di sana lanjutan dirender di layar solusi); minimal. */
  backToChat: '← Percakapan',
  viewSolution: 'Lihat solusi',
  /** Kartu klarifikasi: jawaban ditampung, dikirim sekali (keputusan pemilik 2026-10-06). */
  sendAnswers: 'Kirim jawaban',
  clarifyFailed: 'Jawaban belum tersimpan. Coba lagi.',
  /** Tombol overlay analisis — hanya saat gagal (prototipe). */
  analysisRetry: 'Coba lagi',
  analysisBack: 'Kembali ke percakapan',
} as const;

/** Label lima tahap, dirender apa adanya dari `ANALYSIS_STAGE_LABELS`. */
export const STAGE_ORDER: readonly AnalysisStage[] = [
  'UNDERSTANDING',
  'ANALYZING_INSTALLATION',
  'MATCHING_PRODUCTS',
  'COMPOSING',
  'PREPARING_SCHEMATIC',
];

const ANALYSIS_STAGE_LABELS_EN: Record<AnalysisStage, string> = {
  UNDERSTANDING: 'Understanding your needs',
  ANALYZING_INSTALLATION: 'Analyzing the installation',
  MATCHING_PRODUCTS: 'Matching Pralon products',
  COMPOSING: 'Composing the recommendation',
  PREPARING_SCHEMATIC: 'Preparing the schematic',
};

export function stageLabel(stage: AnalysisStage, locale: Locale = 'id'): string {
  return locale === 'en' ? ANALYSIS_STAGE_LABELS_EN[stage] : ANALYSIS_STAGE_LABELS[stage];
}

/** English twin of `CHAT_COPY` — same keys, same shape (enforced by `CopyShape`). */
export const CHAT_COPY_EN: CopyShape<typeof CHAT_COPY> = {
  brand: { name: 'SNOUTY', kicker: 'PRALON ASSISTANT' },
  newConversation: 'New Consultation',
  historyTitle: 'HISTORY',
  collapsePanel: 'Collapse panel',
  expandPanel: 'Open needs & solution panel',
  historyGuest: 'Sign up to save and reopen your consultations.',
  historyEmpty: 'No other consultations yet.',
  saveSolution: 'Save consultation result',
  saved: 'Saved',
  thinking: 'SNOUTY is thinking',
  toast: {
    title: 'Solution saved',
    sub: 'Thank you! Reopen it any time from History.',
  },
  analysis: {
    running: { title: 'Putting your solution together', sub: 'Usually done within a few seconds.' },
    done: {
      title: 'Solution ready!',
      sub: 'Opening the recommendation, products, schematic, and material estimate.',
    },
    failed: {
      title: 'Could not compose the recommendation',
      sub: 'The connection to the Pralon catalog dropped during the analysis. Your needs are still saved, so there is no need to retype them.',
    },
  },
  composerPlaceholder:
    'Example: I am building a 2-storey house, 3 bathrooms, water tank on the roof…',
  composerPlaceholderChat: 'Type your answer or add details…',
  composerPlaceholderMobile: 'Type your answer…',
  attachPlan: 'Attach floor plan',

  welcome: {
    bubble: "Hi! Tell me about your house, and I'll work out the pipes.",
    sleepBubble: "Zzz… just start typing, I'll wake right up.",
    headline: 'Find the right piping solution for your needs.',
    body: 'Describe your building or installation needs. SNOUTY will help analyze them and recommend Pralon product solutions.',
  },

  headerTitle: 'Consultation',
  headerWelcomeTitle: 'New Consultation',
  meterNote: {
    complete: 'Core data is complete. Values you did not provide are still marked as assumptions.',
    remaining: (missing: number) =>
      `${missing} more data group${missing > 1 ? 's' : ''} before SNOUTY can draft a recommendation.`,
  },
  solutionReady: 'SOLUTION READY',
  titleFor: (building: string | null, floors: number | null) => {
    if (building === 'industrial') return 'Factory — process water line';
    if (building === 'boarding_house') return 'Boarding house — clean water installation';
    if (building === 'light_commercial')
      return floors !== null
        ? `${floors}-storey building — new consultation`
        : 'Commercial building — new consultation';
    if (floors !== null) return `${floors}-storey house — new consultation`;
    return 'New consultation';
  },

  collapseSidebar: 'Collapse sidebar',
  expandSidebar: 'Open sidebar',
  newShort: 'New',
  menu: 'History',
  menuTitle: 'CONSULTATION HISTORY',
  closeDrawer: 'Close menu',
  activeStatus: {
    inProgress: 'IN PROGRESS',
    ready: 'SOLUTION READY',
    reopened: 'REOPENED',
  },
  footer: {
    guestName: 'Guest',
    guestRole: 'Not signed in',
    login: 'Sign in',
    register: 'Sign up',
    role: 'Customer',
    account: 'Account',
  },
  uploading: 'Sending floor plan…',
  uploadFailed: 'The floor plan was not sent. Please try again shortly.',
  newMessagesBelow: 'New messages ↓',
  closePanel: 'Close panel',
  analyzeCta: 'Compose recommendation',
  followUps: {
    title: 'CONTINUE THE CONVERSATION',
    items: (mainSize: string) => [
      'What if I add one more bathroom?',
      `Why use ${mainSize} on the main line?`,
      'What if the tank is on the 3rd floor?',
      'What sizes is the product available in?',
    ],
  },
  mobileNeeds: (n: number) => `Needs (${n})`,
  panelEdit: 'Edit',
  panelDone: 'Done',
  panelSaving: 'Saving…',
  panelEditFailed: 'Changes were not saved. Please try again.',
  mobileSend: '→',

  understood: {
    title: "What I've understood so far",
    readCount: (n: number) => `${n} DATA READ`,
  },

  railLabel: 'NEEDS & SOLUTION',
  railUnit: 'DATA',
  send: 'Send',
  panelTitle: 'Solution Panel',
  requirementsLabel: 'YOUR NEEDS',
  completenessLabel: 'DATA COMPLETENESS',
  boundaryTitle: 'Recommendation boundary',
  boundaryBody:
    'This solution is planning guidance, not a technical certification. For implementation, the final plan should be reviewed with an installer or the Pralon technical team.',
  analysisFooter:
    'SNOUTY only matches against the Pralon catalog. Values that are not available are marked as estimates.',
  llmUnavailable:
    'Language understanding is temporarily unavailable. Please try again shortly — your conversation is still saved.',
  emptyReply:
    'I could not read that message. Try again with the number of floors, bathrooms, and the water source.',
  emptyState: 'Describe your needs as if talking to a consultant. No technical terms needed.',

  criteriaTitle: 'CRITERIA WORTH CHECKING',

  productCards: {
    title: 'RELATED PRALON PRODUCTS',
    open: 'View details',
  },
  contactTechnicalReason: 'Pralon product question from the conversation',
  unsupported: {
    title: 'This need requires further technical checking',
    capturedLabel: "WHAT I'VE NOTED",
    sendToTechnical: 'Send to the Pralon technical team',
    sending: 'Sending…',
    sent: 'Sent to the technical team',
    downloadSummary: 'Download needs summary',
    slaNote: (hours: number) =>
      `The Pralon technical team usually responds within ${hours} working hours.`,
  },

  clarificationTitle: "SO I DON'T HAVE TO GUESS",
  unknownOption: 'Not sure',
  skipToDefaults: 'Skip and use standard assumptions',
  solutionTabs: [
    { id: 'ringkasan', label: 'Summary' },
    { id: 'produk', label: 'Pralon Products' },
    { id: 'skema', label: 'Schematic' },
    { id: 'material', label: 'Material Estimate' },
  ],
  backToChat: '← Conversation',
  viewSolution: 'View solution',
  sendAnswers: 'Send answers',
  clarifyFailed: 'Answers were not saved. Please try again.',
  analysisRetry: 'Try again',
  analysisBack: 'Back to conversation',
};

export function chatCopy(locale: Locale): CopyShape<typeof CHAT_COPY> {
  return pickCopy(locale, CHAT_COPY, CHAT_COPY_EN);
}
