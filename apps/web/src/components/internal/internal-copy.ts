/**
 * Nama alat internal di navigasi back-office.
 *
 * Dulu berkas ini memuat seluruh isi layar alat: judul, paragraf, dan satu kartu per layar
 * yang menyebutkan nomor item dan nomor pertanyaan terbuka ("menunggu OQ-07"). Sejak P29-03
 * layarnya hidup di cangkang yang sama dengan papan prospek dan berbicara dengan kalimat
 * biasa, jadi yang tersisa di sini hanya labelnya.
 *
 * Intelijen pasar tidak ada di daftar ini: ia punya tautannya sendiri di papan.
 */

import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

export const INTERNAL_COPY = {
  nav: [
    { href: '/internal/catalog', label: 'Katalog' },
    { href: '/internal/rules', label: 'Validasi aturan' },
    { href: '/internal/email', label: 'Peninjauan email' },
    { href: '/internal/handoff', label: 'Antrean teknis' },
  ],
} as const;

export const INTERNAL_COPY_EN: CopyShape<typeof INTERNAL_COPY> = {
  nav: [
    { href: '/internal/catalog', label: 'Catalog' },
    { href: '/internal/rules', label: 'Rule validation' },
    { href: '/internal/email', label: 'Email review' },
    { href: '/internal/handoff', label: 'Technical queue' },
  ],
};

export function internalCopy(locale: Locale): CopyShape<typeof INTERNAL_COPY> {
  return pickCopy(locale, INTERNAL_COPY, INTERNAL_COPY_EN);
}
