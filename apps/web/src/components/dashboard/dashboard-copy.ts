/**
 * Teks dashboard admin (P26-05). Layar ini belum didesain (OQ-21) — statusnya dicatat di
 * docs/OPEN_QUESTIONS.md, bukan ditulis di layar (pemilik: tanpa metatext).
 */
import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

export const DASHBOARD_COPY = {
  brand: 'SNOUTY',
  nav: { prospects: 'Prospek', team: 'Tim sales', back: 'Kembali ke konsultasi' },
  prospects: {
    title: 'Prospek',
    subtitle: 'Pelanggan terdaftar menurut tahap 5A dan prioritasnya.',
  },
  stages: {
    aware: { name: 'Aware', meaning: 'Kenal' },
    appeal: { name: 'Appeal', meaning: 'Tertarik' },
    ask: { name: 'Ask', meaning: 'Menimbang' },
    act: { name: 'Act', meaning: 'Bertindak' },
    advocate: { name: 'Advocate', meaning: 'Merekomendasikan' },
  },
  priority: { hot: 'Panas', warm: 'Hangat', cold: 'Dingin' },
  scale: { house: 'Rumah', building: 'Gedung', district: 'Kawasan' },
  leadStatus: {
    new: 'Baru',
    contacted: 'Dihubungi',
    quoted: 'Penawaran',
    won: 'Menang',
    lost: 'Kalah',
  },
  filters: {
    allStages: 'Semua tahap',
    allPriorities: 'Semua prioritas',
    allScales: 'Semua proyek',
    allAssignments: 'Semua penugasan',
    unassigned: 'Belum ditugaskan',
    assigned: 'Sudah ditugaskan',
    search: 'Cari nama atau email',
  },
  columns: {
    customer: 'Pelanggan',
    stage: 'Tahap',
    priority: 'Prioritas',
    project: 'Proyek',
    activity: 'Aktivitas terakhir',
    contact: 'Kontak',
    sales: 'Sales',
  },
  contact: {
    requested: 'Minta dihubungi',
    consent: 'Mengizinkan dihubungi',
    none: 'Belum mengizinkan',
  },
  conversations: (n: number) => `${n} konsultasi`,
  assign: 'Tugaskan ke…',
  summary: 'Ringkasan',
  assignBlocked: 'Belum bisa ditugaskan',
  noSales: 'Tambahkan anggota tim sales dulu',
  empty: 'Belum ada prospek yang cocok.',
  loading: 'Memuat…',
  forbidden: 'Halaman ini untuk tim Pralon. Masuk dengan akun yang punya akses.',
  signIn: 'Masuk',
  failed: 'Tidak bisa memuat sekarang. Coba lagi sebentar.',
  retry: 'Muat ulang',
  team: {
    title: 'Tim sales',
    subtitle: 'Akun terdaftar yang menerima prospek.',
    email: 'Email akun terdaftar',
    add: 'Tambahkan',
    adding: 'Menambahkan…',
    remove: 'Cabut',
    openLeads: (n: number) => `${n} prospek berjalan`,
    empty: 'Belum ada anggota tim sales.',
    adminOnly: 'Hanya admin yang bisa menambah atau mencabut anggota.',
  },
  errors: {
    not_contactable: 'Pelanggan ini belum mengizinkan dihubungi.',
    not_sales: 'Akun itu bukan anggota tim sales.',
    no_account: 'Belum ada akun terdaftar dengan email ini.',
    generic: 'Belum tersimpan. Coba lagi sebentar.',
  } as Record<string, string>,
} as const;

export const DASHBOARD_COPY_EN: CopyShape<typeof DASHBOARD_COPY> = {
  brand: 'SNOUTY',
  nav: { prospects: 'Prospects', team: 'Sales team', back: 'Back to consultation' },
  prospects: {
    title: 'Prospects',
    subtitle: 'Registered customers by 5A stage and priority.',
  },
  stages: {
    aware: { name: 'Aware', meaning: 'Knows us' },
    appeal: { name: 'Appeal', meaning: 'Interested' },
    ask: { name: 'Ask', meaning: 'Considering' },
    act: { name: 'Act', meaning: 'Acting' },
    advocate: { name: 'Advocate', meaning: 'Recommending' },
  },
  priority: { hot: 'Hot', warm: 'Warm', cold: 'Cold' },
  scale: { house: 'House', building: 'Building', district: 'District' },
  leadStatus: {
    new: 'New',
    contacted: 'Contacted',
    quoted: 'Quoted',
    won: 'Won',
    lost: 'Lost',
  },
  filters: {
    allStages: 'All stages',
    allPriorities: 'All priorities',
    allScales: 'All projects',
    allAssignments: 'All assignments',
    unassigned: 'Unassigned',
    assigned: 'Assigned',
    search: 'Search name or email',
  },
  columns: {
    customer: 'Customer',
    stage: 'Stage',
    priority: 'Priority',
    project: 'Project',
    activity: 'Last activity',
    contact: 'Contact',
    sales: 'Sales',
  },
  contact: {
    requested: 'Asked to be contacted',
    consent: 'Agreed to contact',
    none: 'Not agreed yet',
  },
  conversations: (n: number) => `${n} consultation${n === 1 ? '' : 's'}`,
  assign: 'Assign to…',
  summary: 'Summary',
  assignBlocked: 'Cannot be assigned yet',
  noSales: 'Add a sales team member first',
  empty: 'No matching prospects yet.',
  loading: 'Loading…',
  forbidden: 'This page is for the Pralon team. Sign in with an account that has access.',
  signIn: 'Sign in',
  failed: 'Cannot load right now. Please try again shortly.',
  retry: 'Reload',
  team: {
    title: 'Sales team',
    subtitle: 'Registered accounts that receive prospects.',
    email: 'Registered account email',
    add: 'Add',
    adding: 'Adding…',
    remove: 'Remove',
    openLeads: (n: number) => `${n} open prospect${n === 1 ? '' : 's'}`,
    empty: 'No sales team members yet.',
    adminOnly: 'Only admins can add or remove members.',
  },
  errors: {
    not_contactable: 'This customer has not agreed to be contacted.',
    not_sales: 'That account is not on the sales team.',
    no_account: 'No registered account uses this email.',
    generic: 'Not saved. Please try again shortly.',
  },
};

export function dashboardCopy(locale: Locale) {
  return pickCopy(locale, DASHBOARD_COPY, DASHBOARD_COPY_EN);
}
