/**
 * Halaman akun minimal (OQ-53): penanda "menunggu desain" selalu tampil; profil dimuat dari API;
 * kode galat dipetakan ke teks, sandi lama yang salah dibedakan dari sandi baru yang lemah.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_COPY } from './account-copy';
import { AccountPage } from './account-page';

vi.mock('../auth/session', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  restoreSession: () => Promise.resolve(true),
}));

const api = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
  updateName: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('../auth/auth-api', () => api);

const PROFILE = { name: 'Bagus', email: 'bagus@example.test', tier: 'registered' };

afterEach(() => {
  vi.clearAllMocks();
});

describe('AccountPage', () => {
  it('penanda "menunggu desain" tampil, profil dimuat dari API', async () => {
    api.fetchProfile.mockResolvedValue({ ok: true, profile: PROFILE });
    render(<AccountPage />);
    expect(screen.getByText(ACCOUNT_COPY.needsDesign)).toBeDefined();
    await waitFor(() => expect(screen.getByText(PROFILE.email)).toBeDefined());
    expect((screen.getByLabelText(ACCOUNT_COPY.profile.name) as HTMLInputElement).value).toBe(
      'Bagus',
    );
  });

  it('belum masuk → ajakan masuk, tanpa formulir', async () => {
    api.fetchProfile.mockResolvedValue({ ok: false, code: 'UNAUTHENTICATED' });
    render(<AccountPage />);
    await waitFor(() => expect(screen.getByText(ACCOUNT_COPY.signedOut)).toBeDefined());
    expect(screen.queryByLabelText(ACCOUNT_COPY.password.current)).toBeNull();
  });

  it('ganti sandi: sandi lama salah dan sandi baru lemah dibedakan dari kode + reason API', async () => {
    api.fetchProfile.mockResolvedValue({ ok: true, profile: PROFILE });
    render(<AccountPage />);
    await waitFor(() => expect(screen.getByText(PROFILE.email)).toBeDefined());

    const fill = () => {
      fireEvent.change(screen.getByLabelText(ACCOUNT_COPY.password.current), {
        target: { value: 'sandi-lama-yang-panjang' },
      });
      fireEvent.change(screen.getByLabelText(ACCOUNT_COPY.password.next), {
        target: { value: 'sandi-baru-yang-panjang' },
      });
      fireEvent.click(screen.getByText(ACCOUNT_COPY.password.submit));
    };

    api.changePassword.mockResolvedValueOnce({
      ok: false,
      code: 'VALIDATION_FAILED',
      reason: 'current_password',
    });
    fill();
    await waitFor(() =>
      expect(screen.getByText(ACCOUNT_COPY.errors.currentPassword)).toBeDefined(),
    );

    api.changePassword.mockResolvedValueOnce({ ok: false, code: 'VALIDATION_FAILED' });
    fill();
    await waitFor(() => expect(screen.getByText(ACCOUNT_COPY.errors.weakPassword)).toBeDefined());

    api.changePassword.mockResolvedValueOnce({ ok: true });
    fill();
    await waitFor(() => expect(screen.getByText(ACCOUNT_COPY.password.changed)).toBeDefined());
  });
});
