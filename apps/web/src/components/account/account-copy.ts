/**
 * Teks halaman akun (OQ-53). **BELUM DIDESAIN** — dibangun minimal dengan token yang sama,
 * ditandai "menunggu desain" seperti layar masuk/daftar (docs/DESIGN_IMPLEMENTATION.md §11).
 */
import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

export const ACCOUNT_COPY = {
  needsDesign: 'TAMPILAN SEMENTARA · MENUNGGU DESAIN',
  title: 'Akun',
  subtitle: 'Nama, email, kata sandi, dan preferensi tampilan Anda.',
  back: '← Kembali ke konsultasi',
  loading: 'Memuat profil…',
  signedOut: 'Anda belum masuk.',
  signIn: 'Masuk',

  profile: {
    heading: 'Profil',
    name: 'Nama',
    email: 'Email',
    emailNote: 'Email belum bisa diganti dari sini — hubungi tim Pralon bila perlu.',
    tier: 'Jenis akun',
    tiers: { registered: 'Terdaftar', advanced: 'Lanjutan' } as Record<string, string>,
    save: 'Simpan nama',
    saved: 'Nama tersimpan.',
  },

  password: {
    heading: 'Kata sandi',
    current: 'Kata sandi saat ini',
    next: 'Kata sandi baru',
    hint: 'Minimal 12 karakter.',
    submit: 'Ganti kata sandi',
    changed: 'Kata sandi diganti.',
  },

  preferences: {
    heading: 'Tampilan',
    note: 'Tema dan bahasa tersimpan di perangkat ini.',
  },

  session: {
    heading: 'Sesi',
    logout: 'Keluar',
  },

  errors: {
    currentPassword: 'Kata sandi saat ini tidak cocok.',
    weakPassword: 'Kata sandi baru minimal 12 karakter.',
    rateLimited: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
    unauthenticated: 'Sesi Anda sudah habis. Silakan masuk lagi.',
    generic: 'Tidak bisa menyimpan sekarang. Coba lagi sebentar.',
  },
} as const;

export const ACCOUNT_COPY_EN: CopyShape<typeof ACCOUNT_COPY> = {
  needsDesign: 'TEMPORARY SCREEN · AWAITING DESIGN',
  title: 'Account',
  subtitle: 'Your name, email, password, and display preferences.',
  back: '← Back to consultation',
  loading: 'Loading profile…',
  signedOut: 'You are not signed in.',
  signIn: 'Sign in',

  profile: {
    heading: 'Profile',
    name: 'Name',
    email: 'Email',
    emailNote: 'Email cannot be changed here yet — contact the Pralon team if needed.',
    tier: 'Account type',
    tiers: { registered: 'Registered', advanced: 'Advanced' },
    save: 'Save name',
    saved: 'Name saved.',
  },

  password: {
    heading: 'Password',
    current: 'Current password',
    next: 'New password',
    hint: 'At least 12 characters.',
    submit: 'Change password',
    changed: 'Password changed.',
  },

  preferences: {
    heading: 'Display',
    note: 'Theme and language are stored on this device.',
  },

  session: {
    heading: 'Session',
    logout: 'Sign out',
  },

  errors: {
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
