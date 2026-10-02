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
  newConversation: '+ Percakapan baru',
  historyTitle: 'RIWAYAT',
  savedSolutions: 'Solusi Tersimpan',
  productKnowledge: 'Pengetahuan Produk',
  /** Tamu tidak melihat riwayat — ajakan, bukan daftar kosong. */
  historyGuest: 'Daftar akun untuk menyimpan dan membuka kembali konsultasi Anda.',
  historyEmpty: 'Belum ada konsultasi lain.',
  saveSolution: 'Simpan hasil konsultasi',
  saved: 'Tersimpan',
  composerPlaceholder: 'Contoh: Saya bangun rumah 2 lantai, 3 kamar mandi, toren di atap…',
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
