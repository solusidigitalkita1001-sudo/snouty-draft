/**
 * Teks layar masuk dan daftar.
 *
 * **LAYAR INI BELUM DIDESAIN (OQ-21).** Yang dibangun di sini sengaja minimal: token warna
 * dan tipografi yang sama seperti layar lain, tanpa tata letak yang mengaku final. Skill
 * desain memerintahkan tepat ini — bangun minimal, pakai token yang sama, dan **tandai
 * sebagai "needs design"** — karena membuatnya tampak selesai akan menyulitkan desainer nanti
 * (docs/DESIGN_IMPLEMENTATION.md §11).
 *
 * Teksnya sendiri bukan dari desain; ia ditulis sebagai penampung yang jujur dan akan diganti.
 */

import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

export const AUTH_COPY = {
  brand: { name: 'SNOUTY', kicker: 'PRALON ASSISTANT' },

  login: {
    title: 'Masuk',
    subtitle: 'Lanjutkan konsultasi yang sudah Anda simpan.',
    submit: 'Masuk',
    toRegister: 'Belum punya akun? Daftar',
  },
  register: {
    title: 'Daftar akun',
    subtitle: 'Simpan konsultasi, buka kembali kapan saja, dan akses analisis lanjutan.',
    submit: 'Daftar',
    toLogin: 'Sudah punya akun? Masuk',
    /** Dari janji onboarding — tamu yang mendaftar tidak kehilangan percakapannya (G-1). */
    resumeNote:
      'Percakapan yang sedang berjalan akan ikut berpindah ke akun Anda, jadi Anda tidak perlu mengulang cerita.',
  },

  fields: {
    name: 'Nama',
    email: 'Email',
    password: 'Kata sandi',
    passwordHint: 'Minimal 12 karakter.',
    phone: 'Nomor HP (WhatsApp)',
    phonePlaceholder: '0812 3456 7890',
    phoneHint: 'Supaya tim Pralon bisa menghubungi Anda soal kebutuhan pipanya.',
    salesContact: 'Saya bersedia dihubungi tim Pralon soal kebutuhan pipa saya.',
    salesContactHint: 'Bisa diubah kapan saja di menu Akun.',
    showPassword: 'Tampilkan kata sandi',
    hidePassword: 'Sembunyikan kata sandi',
  },

  errors: {
    invalid: 'Email atau kata sandi tidak cocok.',
    emailTaken: 'Email ini sudah terdaftar.',
    weakPassword: 'Kata sandi minimal 12 karakter.',
    phoneInvalid: 'Nomor HP belum sesuai. Pakai nomor seluler Indonesia, misalnya 0812 3456 7890.',
    rateLimited: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
    generic: 'Tidak bisa melanjutkan sekarang. Coba lagi sebentar.',
  },
} as const;

export const AUTH_COPY_EN: CopyShape<typeof AUTH_COPY> = {
  brand: { name: 'SNOUTY', kicker: 'PRALON ASSISTANT' },

  login: {
    title: 'Sign in',
    subtitle: 'Pick up the consultations you saved.',
    submit: 'Sign in',
    toRegister: "Don't have an account? Sign up",
  },
  register: {
    title: 'Create an account',
    subtitle: 'Save consultations, reopen them any time, and access advanced analysis.',
    submit: 'Sign up',
    toLogin: 'Already have an account? Sign in',
    resumeNote:
      'Your current conversation will move to your account, so you will not have to start over.',
  },

  fields: {
    name: 'Name',
    email: 'Email',
    password: 'Password',
    passwordHint: 'At least 12 characters.',
    phone: 'Mobile number (WhatsApp)',
    phonePlaceholder: '0812 3456 7890',
    phoneHint: 'So the Pralon team can contact you about your piping needs.',
    salesContact: 'I agree to be contacted by the Pralon team about my piping needs.',
    salesContactHint: 'You can change this any time in Account.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },

  errors: {
    invalid: 'Email or password does not match.',
    emailTaken: 'This email is already registered.',
    weakPassword: 'Password must be at least 12 characters.',
    phoneInvalid:
      'That mobile number is not valid. Use an Indonesian mobile number, e.g. 0812 3456 7890.',
    rateLimited: 'Too many attempts. Please try again in a few minutes.',
    generic: 'Unable to continue right now. Please try again shortly.',
  },
};

export function authCopy(locale: Locale): CopyShape<typeof AUTH_COPY> {
  return pickCopy(locale, AUTH_COPY, AUTH_COPY_EN);
}
