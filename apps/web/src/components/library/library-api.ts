/**
 * Klien fitur akun (P24-01..03): sematan, proyek, tautan bagikan. Hanya pemanggilan HTTP;
 * kepemilikan dan entitlement ditegakkan di API.
 */
import type {
  ConversationSummary,
  ProjectDetail,
  ProjectSummary,
  SharedSolution,
} from '@snouty/shared-types';
import { apiFetch, authHeaders } from '../auth/session';

const BASE = '/api/v1';

const json = (body: unknown): RequestInit => ({
  credentials: 'include',
  headers: { ...authHeaders(), 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export async function fetchPinned(): Promise<readonly ConversationSummary[]> {
  const response = await apiFetch(`${BASE}/conversations?pinned=true&limit=50`, {
    credentials: 'include',
    headers: authHeaders(),
  });
  if (!response.ok) return [];
  return ((await response.json()) as { items: readonly ConversationSummary[] }).items;
}

export async function setPinned(id: string, pinned: boolean): Promise<boolean> {
  const response = await apiFetch(`${BASE}/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    ...json({ pinned }),
  });
  return response.ok;
}

/** `null` = keluarkan dari proyek. */
export async function moveToProject(id: string, projectId: string | null): Promise<boolean> {
  const response = await apiFetch(`${BASE}/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    ...json({ projectId }),
  });
  return response.ok;
}

export async function fetchProjects(): Promise<readonly ProjectSummary[]> {
  const response = await apiFetch(`${BASE}/projects`, {
    credentials: 'include',
    headers: authHeaders(),
  });
  if (!response.ok) return [];
  return ((await response.json()) as { items: readonly ProjectSummary[] }).items;
}

export async function createProject(
  name: string,
  notes: string | null,
): Promise<ProjectSummary | null> {
  const response = await apiFetch(`${BASE}/projects`, { method: 'POST', ...json({ name, notes }) });
  return response.ok ? ((await response.json()) as ProjectSummary) : null;
}

export async function fetchProject(id: string): Promise<ProjectDetail | null> {
  const response = await apiFetch(`${BASE}/projects/${encodeURIComponent(id)}`, {
    credentials: 'include',
    headers: authHeaders(),
  });
  return response.ok ? ((await response.json()) as ProjectDetail) : null;
}

export async function updateProject(
  id: string,
  patch: { name?: string; notes?: string | null },
): Promise<ProjectSummary | null> {
  const response = await apiFetch(`${BASE}/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    ...json(patch),
  });
  return response.ok ? ((await response.json()) as ProjectSummary) : null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const response = await apiFetch(`${BASE}/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: authHeaders(),
  });
  return response.ok;
}

export interface ShareStatus {
  readonly active: boolean;
  readonly createdAt: string | null;
}

export async function fetchShareStatus(recommendationId: string): Promise<ShareStatus | null> {
  const response = await apiFetch(
    `${BASE}/recommendations/${encodeURIComponent(recommendationId)}/share`,
    { credentials: 'include', headers: authHeaders() },
  );
  return response.ok ? ((await response.json()) as ShareStatus) : null;
}

/** Tautan baru (yang lama otomatis dicabut). Token hanya diterima sekali, di sini. */
export async function createShare(recommendationId: string): Promise<string | null> {
  const response = await apiFetch(
    `${BASE}/recommendations/${encodeURIComponent(recommendationId)}/share`,
    { method: 'POST', credentials: 'include', headers: authHeaders() },
  );
  if (!response.ok) return null;
  const { token } = (await response.json()) as { token: string };
  return shareUrl(token);
}

export async function revokeShare(recommendationId: string): Promise<boolean> {
  const response = await apiFetch(
    `${BASE}/recommendations/${encodeURIComponent(recommendationId)}/share`,
    { method: 'DELETE', credentials: 'include', headers: authHeaders() },
  );
  return response.ok;
}

export function shareUrl(token: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/shared?t=${encodeURIComponent(token)}`;
}

export async function fetchShared(token: string): Promise<SharedSolution | 'not_found' | 'error'> {
  const response = await fetch(`${BASE}/shared/${encodeURIComponent(token)}`, {
    credentials: 'omit',
    headers: { accept: 'application/json' },
  });
  if (response.status === 404 || response.status === 400) return 'not_found';
  if (!response.ok) return 'error';
  return (await response.json()) as SharedSolution;
}
