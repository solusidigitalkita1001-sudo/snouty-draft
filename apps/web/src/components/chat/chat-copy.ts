/**
 * Teks layar konsultasi (layar 02), apa adanya dari desain — satu modul siap i18n.
 *
 * Kalimat batas rekomendasi TIDAK BOLEH diparafrase: ia membawa janji kebijakan
 * ("panduan perencanaan, bukan sertifikasi teknis"), bukan sekadar redaksi
 * (docs/DESIGN_IMPLEMENTATION.md §10).
 */

import { ANALYSIS_STAGE_LABELS, type AnalysisStage } from '@snouty/shared-types';

export const CHAT_COPY = {
  brand: { name: 'SNOUTY', kicker: 'PRALON ASSISTANT' },
  newConversation: 'Konsultasi Baru',
  historyTitle: 'RIWAYAT',
  savedSolutions: 'Solusi Tersimpan',
  collapsePanel: 'Ciutkan panel',
  expandPanel: 'Buka panel kebutuhan & solusi',
  productKnowledge: 'Pengetahuan Produk',
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
  attachPlan: 'Lampirkan denah',

  /** Layar sambutan di dalam ruang konsultasi (prototipe, state `isWelcome`). */
  welcome: {
    /* Teks gelembung dari prototipe (`welcomeBubble`), bukan dari board. */
    bubble: 'Halo! Ceritakan rumahmu, biar aku hitung pipanya.',
    sleepBubble: 'Zzz… ketik saja, aku langsung bangun.',
    headline: 'Temukan solusi perpipaan yang tepat untuk kebutuhan Anda.',
    body: 'Ceritakan kebutuhan bangunan atau instalasi Anda. SNOUTY akan membantu menganalisis kebutuhan dan merekomendasikan solusi produk Pralon.',
  },

  /** Badge status di header: "LANGKAH n DARI 4" selama mengumpulkan data. */
  headerTitle: 'Konsultasi',
  stepStatus: (filled: number) => `LANGKAH ${Math.min(filled + 1, 4)} DARI 4`,
  solutionReady: 'SOLUSI SIAP',

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
  emptyState: 'Ceritakan kebutuhan Anda seperti berbicara dengan konsultan. Tanpa istilah teknis.',

  /** Layar 08 — kriteria netral saat pertanyaan kompetitor ditolak dibandingkan. */
  criteriaTitle: 'KRITERIA YANG SEBAIKNYA DIPERIKSA',

  /** Layar 11 — validasi teknis / belum didukung. */
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
  skipToDefaults: 'Lewati dan gunakan asumsi standar',
} as const;

/** Label lima tahap, dirender apa adanya dari `ANALYSIS_STAGE_LABELS`. */
export const STAGE_ORDER: readonly AnalysisStage[] = [
  'UNDERSTANDING',
  'ANALYZING_INSTALLATION',
  'MATCHING_PRODUCTS',
  'COMPOSING',
  'PREPARING_SCHEMATIC',
];

export function stageLabel(stage: AnalysisStage): string {
  return ANALYSIS_STAGE_LABELS[stage];
}
