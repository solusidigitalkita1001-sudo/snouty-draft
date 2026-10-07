/**
 * Teks pop-up akun (OQ-53). Tanpa penanda "menunggu desain" di layar — pemilik tidak mau metatext;
 * statusnya dicatat di docs/OPEN_QUESTIONS.md, bukan di depan pengguna.
 */
import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

export const ACCOUNT_COPY = {
  title: 'Akun',
  subtitle: 'Nama, kata sandi, dan tampilan.',
  close: 'Tutup',
  loading: 'Memuat…',
  signedOut: 'Anda belum masuk.',
  signIn: 'Masuk',
  register: 'Daftar',

  name: 'Nama',
  email: 'Email',
  tier: 'Jenis akun',
  tiers: { registered: 'Terdaftar', advanced: 'Lanjutan' } as Record<string, string>,

  passwordHeading: 'Ganti kata sandi',
  passwordNote: 'Kosongkan bila tidak ingin mengganti.',
  currentPassword: 'Kata sandi saat ini',
  newPassword: 'Kata sandi baru',
  passwordHint: 'Minimal 12 karakter.',

  display: 'Tampilan',

  save: 'Simpan',
  saving: 'Menyimpan…',
  saved: 'Tersimpan.',
  nothingToSave: 'Tidak ada yang berubah.',
  logout: 'Keluar',

  errors: {
    currentPasswordRequired: 'Isi kata sandi saat ini untuk mengganti kata sandi.',
    currentPassword: 'Kata sandi saat ini tidak cocok.',
    weakPassword: 'Kata sandi baru minimal 12 karakter.',
    rateLimited: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
    unauthenticated: 'Sesi Anda sudah habis. Silakan masuk lagi.',
    generic: 'Tidak bisa menyimpan sekarang. Coba lagi sebentar.',
  },
} as const;

export const ACCOUNT_COPY_EN: CopyShape<typeof ACCOUNT_COPY> = {
  title: 'Account',
  subtitle: 'Name, password, and display.',
  close: 'Close',
  loading: 'Loading…',
  signedOut: 'You are not signed in.',
  signIn: 'Sign in',
  register: 'Sign up',

  name: 'Name',
  email: 'Email',
  tier: 'Account type',
  tiers: { registered: 'Registered', advanced: 'Advanced' },

  passwordHeading: 'Change password',
  passwordNote: 'Leave blank to keep your current password.',
  currentPassword: 'Current password',
  newPassword: 'New password',
  passwordHint: 'At least 12 characters.',

  display: 'Display',

  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved.',
  nothingToSave: 'Nothing has changed.',
  logout: 'Sign out',

  errors: {
    currentPasswordRequired: 'Enter your current password to change it.',
    currentPassword: 'The current password does not match.',
    weakPassword: 'The new password needs at least 12 characters.',
    rateLimited: 'Too many attempts. Try again in a few minutes.',
    unauthenticated: 'Your session has expired. Please sign in again.',
    generic: 'Cannot save right now. Please try again shortly.',
  },
};

export function accountCopy(locale: Locale) {
  return pickCopy(locale, ACCOUNT_COPY, ACCOUNT_COPY_EN);
}
