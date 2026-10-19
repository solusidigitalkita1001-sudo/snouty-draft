/**
 * Onboarding hanya untuk kunjungan pertama (pemilik 2026-10-19: "kalo user ini udh pernah buka
 * website nya tolong wizardnya jangan tampilin lagi"). Server yang memutuskan, tetapi browser yang
 * sudah pernah melihatnya tidak ditampilkan lagi walau subjeknya baru di server.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Onboarding } from './onboarding';

const api = vi.hoisted(() => ({
  ONBOARDING_LS_KEY: 'snouty_onboarding_state',
  fetchOnboardingState: vi.fn(),
  completeOnboarding: vi.fn(async () => undefined),
  fetchBenefits: vi.fn(async () => []),
  recordLocationConsent: vi.fn(async () => undefined),
}));
vi.mock('./onboarding-api', () => api);

const KEY = api.ONBOARDING_LS_KEY;

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('Onboarding — sekali per pengunjung', () => {
  it('kunjungan pertama: wizard tampil dan langsung ditandai sudah dilihat', async () => {
    api.fetchOnboardingState.mockResolvedValueOnce('pending');
    render(<Onboarding />);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(localStorage.getItem(KEY)).toBe('skip');
  });

  it('browser yang sudah pernah melihatnya: tidak tampil walau server bilang pending, server disusulkan', async () => {
    localStorage.setItem(KEY, 'done');
    api.fetchOnboardingState.mockResolvedValueOnce('pending');
    render(<Onboarding />);
    await waitFor(() => expect(api.completeOnboarding).toHaveBeenCalledWith('done'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ditutup di tengah jalan lalu dibuka lagi: tidak tampil lagi', async () => {
    api.fetchOnboardingState.mockResolvedValueOnce('pending');
    const first = render(<Onboarding />);
    await screen.findByRole('dialog');
    first.unmount();

    api.fetchOnboardingState.mockResolvedValueOnce('pending');
    render(<Onboarding />);
    await waitFor(() => expect(api.completeOnboarding).toHaveBeenCalledWith('skip'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('server sudah tahu (akun atau tamu yang sama): tidak tampil, browser ikut mencatat', async () => {
    api.fetchOnboardingState.mockResolvedValueOnce('guest');
    render(<Onboarding />);
    await waitFor(() => expect(localStorage.getItem(KEY)).toBe('guest'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
