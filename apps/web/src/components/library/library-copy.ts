/** Teks fitur akun (P24): proyek, sematan, tautan bagikan — dua bahasa, tanpa label internal. */
import type { Locale } from '@snouty/shared-types';

const ID = {
  projectsTitle: 'PROYEK',
  newProject: 'Proyek baru',
  pinnedTitle: 'DISEMATKAN',
  conversations: (n: number) => `${n} konsultasi`,
  menu: (title: string) => `Pilihan untuk ${title}`,
  pin: 'Sematkan',
  unpin: 'Lepas sematan',
  moveTo: 'Pindahkan ke proyek',
  removeFromProject: 'Keluarkan dari proyek',
  noProjects: 'Belum ada proyek.',
  delete: 'Hapus',
  // Halaman proyek
  projectKicker: 'PROYEK',
  nameLabel: 'Nama proyek',
  namePlaceholder: 'Contoh: Rumah Bekasi, SPAM Desa Sukamaju',
  notesLabel: 'Catatan proyek',
  notesHint:
    'Lokasi, sumber air, bahan yang diinginkan, ukuran bangunan — SNOUTY membacanya di awal setiap konsultasi baru di proyek ini.',
  notesPlaceholder: 'Contoh: rumah 2 lantai 8x12 m di Bekasi, air dari PDAM, pakai pipa PVC Pralon',
  save: 'Simpan',
  saved: 'Tersimpan',
  saveFailed: 'Belum tersimpan. Coba lagi.',
  create: 'Buat proyek',
  cancel: 'Batal',
  newInProject: 'Konsultasi baru di proyek ini',
  projectConversations: 'Konsultasi di proyek ini',
  emptyProject: 'Belum ada konsultasi. Mulai yang pertama dengan tombol di atas.',
  deleteProject: 'Hapus proyek',
  deleteConfirm: 'Hapus proyek ini? Konsultasinya tetap ada di Riwayat.',
  deleteYes: 'Ya, hapus',
  inProject: (name: string) => `Proyek: ${name}`,
  // Bagikan
  share: 'Bagikan',
  shareTitle: 'Bagikan solusi',
  shareSubtitle: 'Tautan baca-saja untuk tukang, toko, atau rekan kerja',
  shareBody:
    'Siapa pun yang memegang tautan ini bisa melihat ringkasan, produk Pralon, denah, dan daftar material solusi ini. Percakapan dan data akun Anda tidak ikut.',
  shareCreate: 'Buat tautan',
  shareRecreate: 'Buat tautan baru',
  shareActive: 'Tautan aktif sejak',
  shareCopy: 'Salin',
  shareCopied: 'Tersalin',
  shareRevoke: 'Cabut tautan',
  shareRevoked: 'Tautan dicabut. Tautan lama tidak bisa dibuka lagi.',
  shareFailed: 'Tautan belum bisa dibuat. Coba lagi sebentar lagi.',
  shareNote: 'Membuat tautan baru otomatis mencabut tautan sebelumnya.',
  close: 'Tutup',
  // Halaman tautan
  sharedKicker: 'SOLUSI DIBAGIKAN',
  sharedAt: 'Dibagikan',
  sharedNotFound: 'Tautan ini tidak ditemukan atau sudah dicabut oleh pemiliknya.',
  sharedError: 'Solusi belum bisa dimuat. Coba muat ulang halaman.',
  sharedLoading: 'Memuat solusi…',
  sharedCta: 'Buat konsultasi sendiri di SNOUTY',
  sharedNotice:
    'Panduan perencanaan — bukan sertifikasi teknis. Hitungan sesuai data pemilik konsultasi.',
};

type LibraryCopy = typeof ID;

const EN: LibraryCopy = {
  projectsTitle: 'PROJECTS',
  newProject: 'New project',
  pinnedTitle: 'PINNED',
  conversations: (n) => `${n} consultation${n === 1 ? '' : 's'}`,
  menu: (title) => `Options for ${title}`,
  pin: 'Pin',
  unpin: 'Unpin',
  moveTo: 'Move to project',
  removeFromProject: 'Remove from project',
  noProjects: 'No projects yet.',
  delete: 'Delete',
  projectKicker: 'PROJECT',
  nameLabel: 'Project name',
  namePlaceholder: 'For example: Bekasi house, Sukamaju village water supply',
  notesLabel: 'Project notes',
  notesHint:
    'Location, water source, preferred material, building size — SNOUTY reads these at the start of every new consultation in this project.',
  notesPlaceholder:
    'For example: 2-storey house 8x12 m in Bekasi, municipal water, Pralon PVC pipes',
  save: 'Save',
  saved: 'Saved',
  saveFailed: 'Not saved yet. Try again.',
  create: 'Create project',
  cancel: 'Cancel',
  newInProject: 'New consultation in this project',
  projectConversations: 'Consultations in this project',
  emptyProject: 'No consultations yet. Start the first one with the button above.',
  deleteProject: 'Delete project',
  deleteConfirm: 'Delete this project? Its consultations stay in History.',
  deleteYes: 'Yes, delete',
  inProject: (name) => `Project: ${name}`,
  share: 'Share',
  shareTitle: 'Share solution',
  shareSubtitle: 'A read-only link for your plumber, shop, or colleague',
  shareBody:
    'Anyone with this link can see the summary, Pralon products, layout, and material list of this solution. The conversation and your account details are not included.',
  shareCreate: 'Create link',
  shareRecreate: 'Create a new link',
  shareActive: 'Link active since',
  shareCopy: 'Copy',
  shareCopied: 'Copied',
  shareRevoke: 'Revoke link',
  shareRevoked: 'Link revoked. The old link no longer opens.',
  shareFailed: 'The link could not be created yet. Try again shortly.',
  shareNote: 'Creating a new link revokes the previous one.',
  close: 'Close',
  sharedKicker: 'SHARED SOLUTION',
  sharedAt: 'Shared',
  sharedNotFound: 'This link was not found or has been revoked by its owner.',
  sharedError: 'The solution could not be loaded. Try reloading the page.',
  sharedLoading: 'Loading solution…',
  sharedCta: 'Start your own consultation on SNOUTY',
  sharedNotice:
    'Planning guidance — not a technical certification. Figures follow the owner’s data.',
};

export function libraryCopy(locale: Locale): LibraryCopy {
  return locale === 'en' ? EN : ID;
}
