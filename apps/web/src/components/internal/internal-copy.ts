/**
 * Teks back-office. **SELURUHNYA BELUM DIDESAIN (OQ-21).**
 *
 * Dibangun minimal dengan token yang sama dan ditandai "menunggu desain", sesuai
 * `docs/DESIGN_IMPLEMENTATION.md` §11 dan §13.
 *
 * Satu hal yang **tidak** sementara: mascot tidak dipakai di back-office (skill desain).
 * Ini alat kerja internal, bukan permukaan produk — dan mascot di sini hanya akan
 * memperlambat orang yang memakainya berjam-jam.
 */

import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

export const INTERNAL_COPY = {
  needsDesign: 'BACK-OFFICE SEMENTARA · MENUNGGU DESAIN (OQ-21)',
  brand: 'SNOUTY · INTERNAL',

  nav: [
    { href: '/internal/catalog', label: 'Katalog', phase: 'P1-10b' },
    { href: '/internal/rules', label: 'Validasi aturan', phase: 'P6-09' },
    { href: '/internal/email', label: 'Peninjauan email', phase: 'P11-05' },
    { href: '/internal/market', label: 'Intelijen pasar', phase: 'P12-03' },
    { href: '/internal/handoff', label: 'Antrean teknis', phase: 'P8-07' },
  ],

  catalog: {
    title: 'Katalog produk',
    body: 'Unggah berkas katalog, periksa laporan validasi, pratinjau draft, lalu promosikan versinya.',
    blocked:
      'Bentuk berkas katalog yang sebenarnya belum diketahui (OQ-07), jadi formulir unggahnya belum dibuat. Daftar versi dan promosi sudah tersedia lewat API.',
  },
  rules: {
    title: 'Validasi aturan teknik',
    body: 'Keempat belas aturan menunggu persetujuan ahli domain. Yang disetujui akan membuat nilai terhitung bisa tampil TERVERIFIKASI.',
    blocked:
      'Menunggu ahli domain ditunjuk (OQ-06). Sampai itu terjadi, seluruh keluaran aturan tetap ASUMSI — dan itu perilaku yang benar.',
  },
  email: {
    title: 'Peninjauan email',
    body: 'AI menganalisis dan membuat draf; manusia meninjau dan mengirim. Tidak ada balasan otomatis.',
    blocked:
      'Pemanggilan model untuk analisis menunggu ID model (OQ-09), dan tujuan pengiriman draf menunggu OQ-08. Redaksi data pribadi sudah berjalan dan teruji.',
  },
  market: {
    title: 'Intelijen pasar',
    body: 'Permintaan regional, tren minat produk, pola tipe proyek, dan corong konsultasi.',
    blocked:
      'Agregasi dan ambang k-anonimitas sudah ada dan teruji; pemancar event dari chat dan email menyusul.',
  },
  handoff: {
    title: 'Antrean teknis',
    body: 'Kasus yang diserahkan pengguna, terlama dulu, beserta kebutuhan yang sudah terkumpul.',
    blocked:
      'Tujuan pengiriman sebenarnya menunggu OQ-08. Antrean dan isinya sudah tersimpan dan bisa dibaca.',
  },

  statusLabel: {
    ready: 'API SIAP',
    blocked: 'MENUNGGU JAWABAN',
  },
} as const;

export const INTERNAL_COPY_EN: CopyShape<typeof INTERNAL_COPY> = {
  needsDesign: 'TEMPORARY BACK-OFFICE · AWAITING DESIGN (OQ-21)',
  brand: 'SNOUTY · INTERNAL',

  nav: [
    { href: '/internal/catalog', label: 'Catalog', phase: 'P1-10b' },
    { href: '/internal/rules', label: 'Rule validation', phase: 'P6-09' },
    { href: '/internal/email', label: 'Email review', phase: 'P11-05' },
    { href: '/internal/market', label: 'Market intelligence', phase: 'P12-03' },
    { href: '/internal/handoff', label: 'Technical queue', phase: 'P8-07' },
  ],

  catalog: {
    title: 'Product catalog',
    body: 'Upload catalog files, review the validation report, preview drafts, then promote the version.',
    blocked:
      'The actual shape of the catalog file is not known yet (OQ-07), so the upload form has not been built. Version listing and promotion are already available through the API.',
  },
  rules: {
    title: 'Engineering rule validation',
    body: 'All fourteen rules await domain expert approval. Approved rules allow calculated values to be shown as VERIFIED.',
    blocked:
      'Waiting for a domain expert to be assigned (OQ-06). Until then, all rule output stays ASSUMPTION, and that is the correct behavior.',
  },
  email: {
    title: 'Email review',
    body: 'AI analyzes and drafts; humans review and send. There are no automatic replies.',
    blocked:
      'Model calls for analysis are waiting on the model ID (OQ-09), and the draft delivery destination is waiting on OQ-08. Personal data redaction is already running and tested.',
  },
  market: {
    title: 'Market intelligence',
    body: 'Regional demand, product interest trends, project type patterns, and the consultation funnel.',
    blocked:
      'Aggregation and the k-anonymity threshold are in place and tested; event emitters from chat and email are coming.',
  },
  handoff: {
    title: 'Technical queue',
    body: 'Cases handed off by users, oldest first, with the requirements gathered so far.',
    blocked:
      'The actual delivery destination is waiting on OQ-08. The queue and its contents are already stored and readable.',
  },

  statusLabel: {
    ready: 'API READY',
    blocked: 'AWAITING ANSWER',
  },
};

export function internalCopy(locale: Locale): CopyShape<typeof INTERNAL_COPY> {
  return pickCopy(locale, INTERNAL_COPY, INTERNAL_COPY_EN);
}

export type InternalSection = Exclude<
  keyof typeof INTERNAL_COPY,
  'needsDesign' | 'brand' | 'nav' | 'statusLabel'
>;
