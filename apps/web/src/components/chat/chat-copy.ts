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
