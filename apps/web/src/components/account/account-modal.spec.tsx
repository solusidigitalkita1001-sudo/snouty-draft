/**
 * Pop-up akun (OQ-53): profil dimuat dari API; satu tombol Simpan untuk nama dan kata sandi;
 * kode galat dipetakan ke teks, sandi lama yang salah dibedakan dari sandi baru yang lemah;
 * tanpa metatext "menunggu desain".
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_COPY } from './account-copy';
import { AccountModal } from './account-modal';

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

describe('AccountModal', () => {
  it('memuat profil; tanpa metatext; dialog bisa ditutup dengan Escape', async () => {
    api.fetchProfile.mockResolvedValue({ ok: true, profile: PROFILE });
    const onClose = vi.fn();
    const { container } = render(<AccountModal onClose={onClose} />);
    await waitFor(() => expect(screen.getByText(PROFILE.email)).toBeDefined());
    expect(container.textContent).not.toContain('MENUNGGU DESAIN');
    expect((screen.getByLabelText(ACCOUNT_COPY.name) as HTMLInputElement).value).toBe('Bagus');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('satu Simpan: nama yang berubah dan sandi baru yang diisi disimpan sekaligus', async () => {
    api.fetchProfile.mockResolvedValue({ ok: true, profile: PROFILE });
    api.updateName.mockResolvedValue({ ok: true, profile: { ...PROFILE, name: 'Jo' } });
    api.changePassword.mockResolvedValue({ ok: true });
    const onProfileChange = vi.fn();
    render(<AccountModal onClose={() => undefined} onProfileChange={onProfileChange} />);
    await waitFor(() => expect(screen.getByText(PROFILE.email)).toBeDefined());

    fireEvent.change(screen.getByLabelText(ACCOUNT_COPY.name), { target: { value: 'Jo' } });
    fireEvent.change(screen.getByLabelText(ACCOUNT_COPY.currentPassword), {
      target: { value: 'sandi-lama-yang-panjang' },
    });
    fireEvent.change(screen.getByLabelText(ACCOUNT_COPY.newPassword), {
      target: { value: 'sandi-baru-yang-panjang' },
    });
    fireEvent.click(screen.getByText(ACCOUNT_COPY.save));

    await waitFor(() => expect(screen.getByText(ACCOUNT_COPY.saved)).toBeDefined());
    expect(api.updateName).toHaveBeenCalledWith('Jo');
    expect(api.changePassword).toHaveBeenCalledWith(
      'sandi-lama-yang-panjang',
      'sandi-baru-yang-panjang',
    );
    expect(onProfileChange).toHaveBeenCalledWith({ ...PROFILE, name: 'Jo' });
    // Hanya satu tombol simpan di seluruh dialog.
    expect(screen.getAllByRole('button', { name: ACCOUNT_COPY.save })).toHaveLength(1);
  });

  it('sandi baru tanpa sandi saat ini ditolak di klien; sandi lama salah vs sandi lemah dibedakan', async () => {
    api.fetchProfile.mockResolvedValue({ ok: true, profile: PROFILE });
    render(<AccountModal onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByText(PROFILE.email)).toBeDefined());

    fireEvent.change(screen.getByLabelText(ACCOUNT_COPY.newPassword), {
      target: { value: 'sandi-baru-yang-panjang' },
    });
    fireEvent.click(screen.getByText(ACCOUNT_COPY.save));
    await waitFor(() =>
      expect(screen.getByText(ACCOUNT_COPY.errors.currentPasswordRequired)).toBeDefined(),
    );
    expect(api.changePassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(ACCOUNT_COPY.currentPassword), {
      target: { value: 'salah' },
    });
    api.changePassword.mockResolvedValueOnce({
      ok: false,
      code: 'VALIDATION_FAILED',
      reason: 'current_password',
    });
    fireEvent.click(screen.getByText(ACCOUNT_COPY.save));
    await waitFor(() =>
      expect(screen.getByText(ACCOUNT_COPY.errors.currentPassword)).toBeDefined(),
    );

    api.changePassword.mockResolvedValueOnce({ ok: false, code: 'VALIDATION_FAILED' });
    fireEvent.click(screen.getByText(ACCOUNT_COPY.save));
    await waitFor(() => expect(screen.getByText(ACCOUNT_COPY.errors.weakPassword)).toBeDefined());
  });
});
