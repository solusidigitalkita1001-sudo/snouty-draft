/**
 * Panggilan API onboarding — satu tempat, bukan `fetch` yang tersebar di komponen.
 *
 * `credentials: 'include'` di setiap panggilan: sesi tamu hidup di cookie
 * `httpOnly`, dan permintaan tanpa cookie adalah tamu baru setiap kali.
 */

export type OnboardingState = 'done' | 'guest' | 'skip' | 'pending';
export type OnboardingOutcome = Exclude<OnboardingState, 'pending'>;

export interface OnboardingBenefit {
  readonly capability: string;
  readonly label: string;
  readonly tag: 'TAMU JUGA' | 'AKUN' | 'LANJUTAN';
}

const BASE = '/api/v1';

export async function fetchOnboardingState(): Promise<OnboardingState> {
  const response = await fetch(`${BASE}/onboarding/state`, { credentials: 'include' });
  if (!response.ok) throw new Error(`onboarding/state ${response.status}`);
  const body = (await response.json()) as { state: OnboardingState };
  return body.state;
}

export async function completeOnboarding(outcome: OnboardingOutcome): Promise<void> {
  await fetch(`${BASE}/onboarding/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ outcome }),
  });
}

export async function fetchBenefits(): Promise<readonly OnboardingBenefit[]> {
  const response = await fetch(`${BASE}/onboarding/benefits`, { credentials: 'include' });
  if (!response.ok) return [];
  const body = (await response.json()) as { items: readonly OnboardingBenefit[] };
  return body.items;
}

export async function recordLocationConsent(granted: boolean): Promise<void> {
  await fetch(`${BASE}/consents`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'LOCATION', granted }),
  });
}

/**
 * `localStorage` HANYA kenyamanan render pertama supaya modal tidak berkedip;
 * server tetap yang berwenang dan keduanya direkonsiliasi saat halaman dimuat
 * (OQ-19, docs/PRIVACY.md §3).
 */
export const ONBOARDING_LS_KEY = 'snouty_onboarding_state';
