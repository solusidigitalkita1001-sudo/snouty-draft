/**
 * Peran internal. docs/BACKOFFICE.md §2 · docs/API_CONTRACTS.md §2.
 *
 * Dikumpulkan sebagai konstanta sejak sekarang supaya nama peran tidak pernah
 * menjadi string yang diketik ulang di dua tempat: satu salah ketik pada guard
 * berarti rute yang tidak bisa dimasuki siapa pun, atau — lebih buruk — rute yang
 * memeriksa peran yang tidak pernah ada.
 *
 * Peran **tidak diwariskan secara implisit** (docs/BACKOFFICE.md §7 tes 8):
 * `admin` bukan `catalog_admin`. Penegakannya menyusul bersama modul `policy`
 * di Fase 5; daftar ini sudah menjadi sumbernya.
 */
export const INTERNAL_ROLES = {
  catalogAdmin: 'catalog_admin',
  domainExpert: 'domain_expert',
  technicalTeam: 'technical_team',
  salesReviewer: 'sales_reviewer',
  admin: 'admin',
} as const;

export type InternalRole = (typeof INTERNAL_ROLES)[keyof typeof INTERNAL_ROLES];
