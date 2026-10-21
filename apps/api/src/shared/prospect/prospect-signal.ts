/**
 * Sinyal tahap 5A dari kejadian yang tidak meninggalkan baris lain (P26-02, docs/PROSPECT_5A.md §2):
 * unduh laporan, buka detail produk, kunjungan tautan bagikan. Deklaratif di endpoint
 * (`@RecordsSignal`) dan dicatat `ProspectSignalInterceptor`, seperti `@Audited` — controller tetap
 * tanpa logika, dan pencatatan tidak pernah menggagalkan permintaan pengguna.
 */
import { createHash } from 'node:crypto';
import { SetMetadata } from '@nestjs/common';

export type ProspectSignalKind = 'report_download' | 'product_view' | 'share_visit';

export interface SignalSpec {
  readonly kind: ProspectSignalKind;
  /** Parameter rute yang menjadi rujukan sinyal. */
  readonly param: string;
  /** Rujukan rahasia (token tautan): yang disimpan SHA-256-nya, sama dengan `share_links.token_hash`. */
  readonly hashed?: boolean;
  /**
   * Hanya bila pengguna masuk. Buka detail produk tidak punya percakapan yang bisa ikut pindah saat
   * tamu mendaftar, dan tamu tidak dipantau per orang (OQ-76).
   */
  readonly registeredOnly?: boolean;
}

export const RECORDS_SIGNAL = 'snouty:prospect-signal';

export const RecordsSignal = (spec: SignalSpec) => SetMetadata(RECORDS_SIGNAL, spec);

export const PROSPECT_SIGNAL = {
  reportDownload: { kind: 'report_download', param: 'id' },
  productView: { kind: 'product_view', param: 'id', registeredOnly: true },
  shareVisit: { kind: 'share_visit', param: 'token', hashed: true },
} as const satisfies Record<string, SignalSpec>;

export interface SignalRow {
  readonly kind: ProspectSignalKind;
  readonly refId: string;
  readonly userId: string | null;
  /** `YYYY-MM-DD` — presisi hari cukup untuk tahap dan kebaruan. */
  readonly occurredOn: string;
  readonly dedupeKey: string;
}

interface SignalRequest {
  readonly params?: Record<string, unknown>;
  readonly authUser?: { readonly userId: string };
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Baris sinyal dari request yang berhasil; `null` bila tidak ada yang pantas dicatat. */
export function signalRowOf(spec: SignalSpec, request: SignalRequest, now: Date): SignalRow | null {
  const raw = request.params?.[spec.param];
  if (typeof raw !== 'string' || raw === '' || raw.length > 128) return null;
  const userId = request.authUser?.userId ?? null;
  if (spec.registeredOnly && userId === null) return null;
  const refId = spec.hashed ? sha256(raw) : raw;
  if (refId.length > 64) return null;
  const occurredOn = now.toISOString().slice(0, 10);
  return {
    kind: spec.kind,
    refId,
    userId,
    occurredOn,
    dedupeKey: sha256(`${spec.kind}|${refId}|${userId ?? ''}|${occurredOn}`),
  };
}
