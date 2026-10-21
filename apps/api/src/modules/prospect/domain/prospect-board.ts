/**
 * Papan prospek dashboard admin (P26-05, docs/PROSPECT_5A.md §4). Hanya pengguna terdaftar tanpa peran
 * internal; tamu tidak pernah muncul per orang (OQ-76).
 */
import type {
  Priority,
  ProjectScale,
  ProspectEvent,
  ProspectView,
  Stage,
} from './prospect-stage.js';

export const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadAssignment {
  readonly salesUserId: string;
  readonly salesName: string;
  readonly status: LeadStatus;
  readonly assignedAt: Date;
}

/** Semua yang diketahui tentang satu pengguna terdaftar, sebelum dinilai. */
export interface ProspectRecord {
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly phone: string | null;
    readonly createdAt: Date;
  };
  readonly events: readonly ProspectEvent[];
  readonly scales: readonly ProjectScale[];
  readonly salesContactConsent: boolean;
  readonly salesRequestedAt: Date | null;
  readonly conversationCount: number;
  readonly lead: LeadAssignment | null;
}

export interface ProspectRow extends ProspectView {
  readonly user: ProspectRecord['user'];
  readonly salesContactConsent: boolean;
  readonly salesRequestedAt: Date | null;
  readonly contactable: boolean;
  readonly conversationCount: number;
  readonly lead: LeadAssignment | null;
}

export interface ProspectFilter {
  readonly stage?: Stage | undefined;
  readonly priority?: Priority | undefined;
  readonly scale?: ProjectScale | undefined;
  readonly assignment?: 'assigned' | 'unassigned' | undefined;
  /** Nama atau email, tanpa membedakan huruf besar. */
  readonly q?: string | undefined;
}

/**
 * Dasar sah sales menghubungi (OQ-76): opt-in "boleh dihubungi tim Pralon", atau pengguna sendiri
 * menekan "minta dihubungi". Tanpa salah satunya prospek hanya dipantau, tidak ditugaskan.
 */
export function canBeContacted(prospect: {
  readonly salesContactConsent: boolean;
  readonly salesRequestedAt: Date | null;
}): boolean {
  return prospect.salesContactConsent || prospect.salesRequestedAt !== null;
}

export class ProspectNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor() {
    super('Prospek tidak ditemukan.');
    this.name = 'ProspectNotFoundError';
  }
}

/** Prospek tanpa izin maupun permintaan kontak tidak boleh ditugaskan ke sales. */
export class NotContactableError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly details = { reason: 'not_contactable' };
  constructor() {
    super('Pengguna ini belum mengizinkan dihubungi tim Pralon.');
    this.name = 'NotContactableError';
  }
}

export class NotSalesError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly details = { reason: 'not_sales' };
  constructor() {
    super('Akun ini bukan anggota tim sales.');
    this.name = 'NotSalesError';
  }
}

export class AccountNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  readonly details = { reason: 'no_account' };
  constructor() {
    super('Belum ada akun terdaftar dengan email ini.');
    this.name = 'AccountNotFoundError';
  }
}

export interface SalesMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  /** Prospek yang sedang ditanganinya (belum menang/kalah). */
  readonly openLeads: number;
}

export interface ProspectStore {
  /** Seluruh pengguna terdaftar aktif tanpa peran internal, dengan kejadiannya. */
  readAll(): Promise<readonly ProspectRecord[]>;
  /** Dasar kontak satu pengguna; `null` bila bukan prospek (tidak ada / punya peran internal). */
  contactBasis(userId: string): Promise<{
    readonly salesContactConsent: boolean;
    readonly salesRequestedAt: Date | null;
  } | null>;
  isSales(userId: string): Promise<boolean>;
  /** Satu penugasan per prospek: dibuat, atau dipindah ke sales lain (statusnya tetap). */
  assign(input: { userId: string; salesUserId: string; assignedBy: string }): Promise<void>;
  salesTeam(): Promise<readonly SalesMember[]>;
  /** `null` bila email tidak terdaftar. */
  grantSales(email: string, grantedBy: string): Promise<{ readonly userId: string } | null>;
  revokeSales(userId: string): Promise<void>;
}

export const PROSPECT_STORE = Symbol('PROSPECT_STORE');
