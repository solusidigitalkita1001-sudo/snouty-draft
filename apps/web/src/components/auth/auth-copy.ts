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

export const AUTH_COPY = {
  needsDesign: 'TAMPILAN SEMENTARA · MENUNGGU DESAIN',
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
    showPassword: 'Tampilkan kata sandi',
    hidePassword: 'Sembunyikan kata sandi',
  },

  errors: {
    invalid: 'Email atau kata sandi tidak cocok.',
    emailTaken: 'Email ini sudah terdaftar.',
    weakPassword: 'Kata sandi minimal 12 karakter.',
    rateLimited: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
    generic: 'Tidak bisa melanjutkan sekarang. Coba lagi sebentar.',
  },
} as const;
