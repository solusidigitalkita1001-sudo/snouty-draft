/**
 * Skema ekstraksi email. docs/EMAIL_INTELLIGENCE.md §4.
 *
 * Sama disiplinnya dengan ekstraksi chat: `.strict()`, enum tertutup, batas numerik —
 * keluaran model adalah masukan tak tepercaya (docs/SECURITY.md §5).
 *
 * Satu perbedaan penting dari skema chat: di sini `nullable()` **memang benar**, bukan
 * `optional()`. Alasannya berbeda situasinya — pada chat, "tidak disebut" harus dibedakan
 * dari "dinyatakan tidak ada" karena state di-merge bertahap. Analisis email dibuat
 * sekali untuk satu email utuh, jadi `null` berarti "tidak ada di email ini", dan tidak
 * ada giliran berikutnya yang bisa menimpanya.
 */

import { z } from 'zod';

export const EmailAnalysisSchema = z
  .object({
    intent: z.enum([
      'permintaan_penawaran',
      'pertanyaan_produk',
      'pertanyaan_teknis',
      'keluhan',
      'kemitraan',
      'lainnya',
    ]),
    leadType: z.enum([
      'kontraktor',
      'developer',
      'distributor',
      'pemilik_bangunan',
      'konsultan',
      'tidak_diketahui',
    ]),
    company: z.string().max(200).nullable(),
    projectType: z.enum(['hunian', 'komersial', 'industri', 'infrastruktur']).nullable(),
    /** Tingkat kota saja — konsisten dengan kebijakan lokasi (docs/PRIVACY.md). */
    projectLocation: z.string().max(120).nullable(),
    projectScale: z.enum(['kecil', 'sedang', 'besar']).nullable(),
    unitCount: z.number().int().min(0).max(1_000_000).nullable(),
    buildingInfo: z.string().max(500).nullable(),
    /**
     * Nama produk sebagaimana ditulis pengirim. Dicocokkan ke katalog SETELAH ekstraksi;
     * yang tidak cocok disimpan sebagai teks dan **tidak** dipaksa menjadi SKU — memaksa
     * kecocokan adalah cara halus mengarang produk.
     */
    requestedProducts: z.array(z.string().max(120)).max(50),
    quotationIntent: z.boolean(),
    missingTechnicalInfo: z.array(z.string().max(200)).max(20),
    urgency: z.enum(['rendah', 'sedang', 'tinggi']).nullable(),
  })
  .strict();

export type EmailAnalysis = z.infer<typeof EmailAnalysisSchema>;
