/**
 * Klien laporan — `POST /reports` lalu `GET /reports/:id` untuk pratinjau (docs/REPORT.md §8).
 *
 * `not-entitled` dibedakan dari galat lain: `REPORT_PDF` hanya untuk tier tertentu, dan UI
 * harus mengatakannya apa adanya alih-alih "coba lagi" — percobaan ulang tidak akan
 * mengubah apa pun.
 */

import type { ApiErrorBody, ReportCreated, ReportPreview } from '@snouty/shared-types';

import { authHeaders } from '../auth/session';

const BASE = '/api/v1';

export type ReportResult<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'not-entitled' }
  | { readonly kind: 'error' };

export async function createReport(input: {
  recommendationId: string;
  customerName: string;
  projectLocation: string;
}): Promise<ReportResult<ReportCreated>> {
  try {
    const response = await fetch(`${BASE}/reports`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    return await resultOf<ReportCreated>(response);
  } catch {
    return { kind: 'error' };
  }
}

export async function fetchReport(id: string): Promise<ReportResult<ReportPreview>> {
  try {
    const response = await fetch(`${BASE}/reports/${encodeURIComponent(id)}`, {
      credentials: 'include',
      headers: authHeaders(),
    });
    return await resultOf<ReportPreview>(response);
  } catch {
    return { kind: 'error' };
  }
}

async function resultOf<T>(response: Response): Promise<ReportResult<T>> {
  if (response.ok) return { kind: 'ok', value: (await response.json()) as T };
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    if (body?.error.code === 'NOT_ENTITLED') return { kind: 'not-entitled' };
  }
  return { kind: 'error' };
}
