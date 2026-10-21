/**
 * Jejak audit tindakan pengguna (audit keamanan 2026-10-14, docs/INCIDENT.md §4): siapa, apa, kapan,
 * dari IP mana — supaya cakupan sebuah insiden bisa ditelusuri dari `audit_logs`, bukan hanya dari log
 * nginx. **Tanpa isi**: tidak ada teks percakapan, kata sandi, atau token yang dicatat (PRIVACY.md).
 *
 * Deklaratif di endpoint (`@Audited`) dan dicatat oleh `AuditInterceptor`, sehingga controller tetap
 * tanpa logika dan service tidak perlu tahu soal IP atau correlation ID.
 */
import { SetMetadata } from '@nestjs/common';

export interface AuditSpec {
  /** Verba Inggris bertitik, mis. `auth.login`. */
  readonly action: string;
  readonly entityType: string;
  /** Catat juga percobaan yang gagal sebagai `<action>.failed` (login, ganti kata sandi). */
  readonly recordFailure?: boolean;
}

export const AUDITED = 'snouty:audited';

export const Audited = (spec: AuditSpec) => SetMetadata(AUDITED, spec);

/** Verba audit tindakan pengguna. */
export const USER_AUDIT = {
  register: { action: 'auth.register', entityType: 'user' },
  login: { action: 'auth.login', entityType: 'user', recordFailure: true },
  logout: { action: 'auth.logout', entityType: 'user' },
  passwordChange: { action: 'auth.password.change', entityType: 'user', recordFailure: true },
  profileUpdate: { action: 'auth.profile.update', entityType: 'user' },
  conversationSave: { action: 'conversation.save', entityType: 'conversation' },
  conversationDelete: { action: 'conversation.delete', entityType: 'conversation' },
  conversationRestore: { action: 'conversation.restore', entityType: 'conversation' },
  // Fase 24: proyek dan tautan bagikan (P24-02/03).
  projectCreate: { action: 'project.create', entityType: 'project' },
  projectUpdate: { action: 'project.update', entityType: 'project' },
  projectDelete: { action: 'project.delete', entityType: 'project' },
  shareCreate: { action: 'share.create', entityType: 'recommendation' },
  shareRevoke: { action: 'share.revoke', entityType: 'recommendation' },
  handoffCreate: { action: 'handoff.create', entityType: 'conversation' },
  salesRequest: { action: 'sales.request', entityType: 'conversation' },
  reportCreate: { action: 'report.create', entityType: 'report' },
  reportRebuild: { action: 'report.rebuild', entityType: 'report' },
  uploadCreate: { action: 'upload.create', entityType: 'upload' },
  consentRecord: { action: 'consent.record', entityType: 'consent' },
  onboardingComplete: { action: 'onboarding.complete', entityType: 'onboarding' },
} as const satisfies Record<string, AuditSpec>;
