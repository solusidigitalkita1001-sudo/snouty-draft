/**
 * Layar auth minimal (OQ-21): yang diuji **bukan** tampilannya — itu akan diganti desainer —
 * melainkan dua hal yang harus tetap benar apa pun desainnya:
 *
 *   1. Banner "menunggu desain" tidak bisa disembunyikan. Layar sementara yang tampak final
 *      adalah layar yang akan dikira selesai, lalu menyulitkan desainer.
 *   2. Kode galat API dipetakan ke teks Indonesia, bukan ditampilkan mentah.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AUTH_COPY } from './auth-copy';
import { AuthForm } from './auth-form';

describe('penanda "menunggu desain"', () => {
  it('tampil di layar masuk', () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByText(AUTH_COPY.needsDesign)).toBeDefined();
  });

  it('tampil di layar daftar', () => {
    render(<AuthForm mode="register" />);
    expect(screen.getByText(AUTH_COPY.needsDesign)).toBeDefined();
  });

  it('tidak ada prop yang bisa menyembunyikannya — hanya `mode` yang diterima', () => {
    expect(AuthForm.length).toBe(1);
  });
});

describe('formulir', () => {
  it('masuk tidak meminta nama; daftar meminta', () => {
    const { unmount } = render(<AuthForm mode="login" />);
    expect(screen.queryByText(AUTH_COPY.fields.name)).toBeNull();
    unmount();

    render(<AuthForm mode="register" />);
    expect(screen.getByText(AUTH_COPY.fields.name)).toBeDefined();
  });

  it('daftar menjelaskan percakapan tamu akan berpindah (janji G-1)', () => {
    render(<AuthForm mode="register" />);
    expect(screen.getByText(/tidak perlu mengulang cerita/)).toBeDefined();
  });

  it('kata sandi meminta minimal 12 karakter, sesuai kebijakan server', () => {
    render(<AuthForm mode="register" />);
    const input = screen.getByLabelText(AUTH_COPY.fields.password) as HTMLInputElement;
    expect(input.minLength).toBe(12);
  });

  it('petunjuk kata sandi dirujuk aria-describedby, bukan di dalam label', () => {
    // Teks di dalam label ikut menjadi nama aksesibelnya; pembaca layar akan menyebut
    // "Kata sandi Minimal 12 karakter" setiap kali field itu disinggung.
    render(<AuthForm mode="register" />);
    const input = screen.getByLabelText(AUTH_COPY.fields.password);
    expect(input.getAttribute('aria-describedby')).toBe('password-hint');
    expect(screen.getByText(AUTH_COPY.fields.passwordHint).id).toBe('password-hint');
  });

  it('memakai autocomplete yang benar supaya pengelola sandi bekerja', () => {
    render(<AuthForm mode="login" />);
    const password = screen.getByLabelText(AUTH_COPY.fields.password);
    expect(password.getAttribute('autocomplete')).toBe('current-password');
  });

  it('menautkan ke layar sebaliknya', () => {
    render(<AuthForm mode="login" />);
    const link = screen.getByText(AUTH_COPY.login.toRegister);
    expect(link.getAttribute('href')).toBe('/register');
  });
});

describe('validasi sebelum kirim', () => {
  it('tidak mengirim permintaan saat field wajib kosong', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<AuthForm mode="login" />);
    screen.getByRole('button', { name: AUTH_COPY.login.submit }).closest('form')!.requestSubmit();

    // Permintaan kosong hanya menghabiskan kuota rate limit dan menghasilkan 400.
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('pemetaan galat', () => {
  it('kode API dipetakan ke teks Indonesia, bukan ditampilkan mentah', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { code: 'RATE_LIMITED' } }), { status: 429 }),
        ),
      ),
    );

    render(<AuthForm mode="login" />);
    // Field diisi lebih dulu: `required` membuat browser menolak submit yang kosong, dan itu
    // perilaku yang benar — formulirnya memang tidak boleh mengirim permintaan kosong.
    fireEvent.change(screen.getByLabelText(AUTH_COPY.fields.email), {
      target: { value: 'budi@contoh.co.id' },
    });
    fireEvent.change(screen.getByLabelText(AUTH_COPY.fields.password), {
      target: { value: 'katasandipanjang' },
    });

    // `getByRole('button')` dan bukan teks: judul layar dan tombol kirim sama-sama "Masuk".
    const form = screen.getByRole('button', { name: AUTH_COPY.login.submit }).closest('form')!;
    form.requestSubmit();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(AUTH_COPY.errors.rateLimited);
    expect(alert.textContent).not.toContain('RATE_LIMITED');
    vi.unstubAllGlobals();
  });
});
