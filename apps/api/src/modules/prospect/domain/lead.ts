/**
 * Prospek yang ditugaskan ke sales (P26-06, docs/PROSPECT_5A.md §4): akses, status, dan ringkasan
 * percakapan. Angka teknis dan produk di ringkasan selalu dari baris terstruktur; paragraf konteks dari
 * model hanya penjelas, dan hilang bila memuat angka yang tidak ada di data.
 */
import type { LeadStatus } from './prospect-board.js';

export interface LeadRecord {
  readonly userId: string;
  readonly assignedTo: string;
  readonly status: LeadStatus;
  readonly lostReason: string | null;
  readonly assignedAt: Date;
  readonly context: LeadContext | null;
  /** Kapan prospek ini perlu ditengok lagi (P27-09); `null` = belum dijadwalkan. */
  readonly followUpAt: Date | null;
}

/**
 * Satu baris jejak tindak lanjut (P27-09). Append-only: riwayat yang bisa diubah bukan riwayat.
 * `kind` menentukan kolom mana yang terisi — catatan, status baru, atau tanggal tengok.
 */
export interface LeadActivity {
  readonly id: string;
  readonly kind: 'note' | 'status' | 'follow_up' | 'assigned';
  readonly actorId: string;
  readonly actorName: string | null;
  readonly note: string | null;
  readonly status: LeadStatus | null;
  readonly followUpAt: Date | null;
  readonly at: Date;
}

export interface NewLeadActivity {
  readonly id: string;
  readonly userId: string;
  readonly actorId: string;
  readonly kind: LeadActivity['kind'];
  readonly note: string | null;
  readonly status: LeadStatus | null;
  readonly followUpAt: Date | null;
}

/** Catatan kosong bukan catatan; batasnya sama dengan kolomnya. */
export const MAX_NOTE_CHARS = 1000;

export class EmptyNoteError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly details = { reason: 'note' };
  constructor() {
    super('Catatannya masih kosong.');
    this.name = 'EmptyNoteError';
  }
}

export interface LeadContext {
  readonly text: string;
  readonly generatedAt: string;
}

/** Satu konsultasi pengguna, dari snapshot kebutuhan dan rekomendasi terakhirnya. */
export interface LeadProject {
  readonly conversationId: string;
  readonly title: string | null;
  readonly updatedAt: Date;
  readonly buildingType: string | null;
  readonly floors: number | null;
  readonly bathrooms: number | null;
  readonly waterSource: string | null;
  readonly caseId: string | null;
  /** Kalimat ringkas hasil hitungan, ditulis engine — bukan model. */
  readonly headline: string | null;
  readonly mainSize: string | null;
  readonly products: readonly {
    readonly name: string;
    readonly family: string | null;
    readonly size: string | null;
  }[];
}

export interface LeadFacts {
  readonly projects: readonly LeadProject[];
  readonly reports: number;
  readonly shares: number;
  readonly salesRequest: { readonly source: string; readonly at: Date } | null;
  /** Kalimat pengguna terakhir, dipotong — konteks bagi sales, bukan sumber angka. */
  readonly quotes: readonly { readonly text: string; readonly at: Date }[];
}

export interface InternalViewer {
  readonly id: string;
  readonly roles: readonly string[];
}

/** Admin dan peninjau sales melihat semua prospek; sales hanya yang ditugaskan kepadanya (OQ-76). */
export function canSeeLead(lead: { readonly assignedTo: string }, viewer: InternalViewer): boolean {
  if (viewer.roles.includes('admin') || viewer.roles.includes('sales_reviewer')) return true;
  return viewer.roles.includes('sales') && lead.assignedTo === viewer.id;
}

/** Kalah tanpa alasan tidak bisa dipakai mengkalibrasi prioritas (docs/PROSPECT_5A.md §5). */
export function validStatusChange(status: LeadStatus, lostReason: string | null): boolean {
  if (status === 'lost') return lostReason !== null && lostReason.trim().length > 0;
  return true;
}

export class LeadNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor() {
    super('Prospek tidak ditemukan.');
    this.name = 'LeadNotFoundError';
  }
}

export class LostReasonRequiredError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly details = { reason: 'lost_reason' };
  constructor() {
    super('Tulis alasan kalahnya.');
    this.name = 'LostReasonRequiredError';
  }
}

export interface TranscriptLine {
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly at: Date;
}

export interface LeadStore {
  findLead(userId: string): Promise<LeadRecord | null>;
  setStatus(userId: string, status: LeadStatus, lostReason: string | null): Promise<void>;
  setContext(userId: string, context: LeadContext): Promise<void>;
  facts(userId: string): Promise<LeadFacts>;
  /** `null` bila percakapan bukan milik pengguna itu. */
  transcript(userId: string, conversationId: string): Promise<readonly TranscriptLine[] | null>;
  /** Jejak tindak lanjut, terbaru dulu (P27-09). */
  activity(userId: string): Promise<readonly LeadActivity[]>;
  appendActivity(row: NewLeadActivity): Promise<void>;
  setFollowUp(userId: string, at: Date | null): Promise<void>;
}

export const LEAD_STORE = Symbol('LEAD_STORE');
