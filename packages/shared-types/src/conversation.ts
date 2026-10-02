/**
 * Tipe percakapan yang dibagi web dan api. docs/DOMAIN_MODEL.md §4.
 */

import type { AssistantCard } from './assistant-card.js';

/** Diturunkan dari tag yang benar-benar muncul di desain (termasuk OQ-28). */
export type ConversationStatus =
  | 'IN_PROGRESS'
  | 'CHECKING_DATA'
  | 'ANALYZING'
  | 'INCOMPLETE_DATA'
  | 'SOLUTION_READY'
  | 'NEEDS_VALIDATION'
  | 'SAVED'
  | 'REOPENED';

/** Tag di UI — satu-satunya sumber teksnya, supaya layar tidak menulis sendiri. */
export const CONVERSATION_STATUS_LABELS: Readonly<Record<ConversationStatus, string>> = {
  IN_PROGRESS: 'SEDANG BERLANGSUNG',
  CHECKING_DATA: 'MEMERIKSA DATA',
  ANALYZING: 'MENGANALISIS…',
  INCOMPLETE_DATA: 'DATA BELUM LENGKAP',
  SOLUTION_READY: 'SOLUSI SIAP',
  NEEDS_VALIDATION: 'PERLU VALIDASI',
  SAVED: 'DISIMPAN',
  REOPENED: 'DIBUKA KEMBALI',
};

/** Indikator tahap di header: Kebutuhan → Analisis → Solusi → Laporan. */
export type ConversationStage = 'KEBUTUHAN' | 'ANALISIS' | 'SOLUSI' | 'LAPORAN';

export type MessageRole = 'user' | 'assistant';

export interface ConversationSummary {
  readonly id: string;
  /** NULL sampai LLM menamainya dari pesan pertama (Fase 4). */
  readonly title: string | null;
  readonly status: ConversationStatus;
  readonly stage: ConversationStage;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ConversationMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly text: string;
  readonly cards: readonly AssistantCard[];
  readonly mood: string | null;
  readonly createdAt: string;
}
