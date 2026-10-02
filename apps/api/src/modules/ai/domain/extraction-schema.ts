/**
 * Skema ekstraksi terstruktur (zod). docs/AI_BEHAVIOR.md · docs/CONTEXT_ENGINE.md §4.
 *
 * Tiga hal yang mudah salah, dan semuanya dicegah di sini:
 *
 *   - **`optional()`, BUKAN `nullable()`.** Tidak disebut = `undefined`; dinyatakan
 *     tidak ada = `0`. Kalau keduanya jadi `null`, sistem menanyakan ulang hal yang
 *     sudah dijawab (CONTEXT_ENGINE §4). Merge memperlakukan `undefined` sebagai
 *     "tidak disebut"; ketiadaan eksplisit sampai sebagai angka nyata.
 *   - **Batas numerik masuk akal.** Menolak keluaran kacau (900 lantai) sebelum jadi
 *     skema.
 *   - **Enum tertutup.** Nilai di luar daftar ditolak, bukan disimpan string bebas.
 *
 * Skema ini `.strict()`: properti tak dikenal dari model DITOLAK, bukan diabaikan
 * (docs/SECURITY.md §5) — keluaran model adalah masukan tak tepercaya.
 */

import { z } from 'zod';

export const ExtractionSchema = z
  .object({
    building: z
      .object({
        type: z
          .enum(['residential', 'boarding_house', 'light_commercial', 'industrial'])
          .optional(),
        floors: z.number().int().min(1).max(50).optional(),
        floorHeightM: z.number().min(2).max(10).optional(),
        mainRunMeters: z.number().min(0).max(5_000).optional(),
      })
      .strict()
      .optional(),
    fixtures: z
      .object({
        bathrooms: z.number().int().min(0).max(200).optional(),
        basins: z.number().int().min(0).max(200).optional(),
        kitchens: z.number().int().min(0).max(100).optional(),
        outletCount: z.number().int().min(0).max(1_000).optional(),
      })
      .strict()
      .optional(),
    water: z
      .object({
        source: z.enum(['rooftop_tank', 'ground_tank', 'pump', 'municipal']).optional(),
        installationType: z.enum(['clean_water', 'drainage', 'both']).optional(),
        boosterPump: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type Extraction = z.infer<typeof ExtractionSchema>;

/** Intent dikembalikan model sebagai enum tertutup; di luar daftar → ditolak. */
export const IntentSchema = z
  .object({
    intent: z.enum([
      'REQUIREMENT_STATEMENT',
      'REQUIREMENT_MUTATION',
      'PRODUCT_LOOKUP',
      'EXPLANATION_REQUEST',
      'CLARIFICATION_ANSWER',
      'COMPETITOR_QUESTION',
      'OUT_OF_SCOPE',
      'CLARIFICATION_NEEDED',
    ]),
    /** Keyakinan 0–1; di bawah ambang pemanggil memilih bertanya, bukan menebak. */
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type IntentClassification = z.infer<typeof IntentSchema>;
