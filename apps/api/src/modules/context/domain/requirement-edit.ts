/**
 * Skema edit satu field kebutuhan — dipakai PATCH panel kanan dan contoh rumah (P22-01): nilai
 * yang masuk ke merger selalu lewat batas yang sama dengan skema ekstraksi. Tidak ada field bebas.
 */
import { z } from 'zod';

/**
 * Edit inline panel kanan — hanya tujuh field yang tampil di panel, dengan nilai yang
 * persis sama batasnya dengan skema ekstraksi. Tidak ada field bebas: path di luar
 * daftar ini ditolak, bukan diteruskan ke merger.
 */
const count = (max: number) => z.number().int().min(0).max(max);
export const RequirementEditSchema = z.union([
  z
    .object({
      path: z.literal('building.type'),
      value: z.enum([
        'residential',
        'boarding_house',
        'light_commercial',
        'industrial',
        'place_of_worship',
        'public_building',
      ]),
    })
    .strict(),
  z.object({ path: z.literal('building.floors'), value: z.number().int().min(1).max(50) }).strict(),
  z
    .object({
      path: z.enum(['fixtures.bathrooms', 'fixtures.basins']),
      value: count(200),
    })
    .strict(),
  z.object({ path: z.literal('fixtures.kitchens'), value: count(100) }).strict(),
  z.object({ path: z.literal('fixtures.wudhuTaps'), value: count(500) }).strict(),
  z.object({ path: z.literal('fixtures.wudhuAreas'), value: count(50) }).strict(),
  z.object({ path: z.literal('fixtures.urinals'), value: count(200) }).strict(),
  z
    .object({
      path: z.literal('building.dimensions'),
      // Bangunan dan/atau tanah, masing-masing berpasangan (panjang + lebar).
      value: z
        .object({
          lengthM: z.number().min(2).max(200).optional(),
          widthM: z.number().min(2).max(200).optional(),
          landLengthM: z.number().min(2).max(1000).optional(),
          landWidthM: z.number().min(2).max(1000).optional(),
        })
        .strict()
        .refine(
          (d) =>
            (d.lengthM === undefined) === (d.widthM === undefined) &&
            (d.landLengthM === undefined) === (d.landWidthM === undefined) &&
            (d.lengthM !== undefined || d.landLengthM !== undefined),
          { message: 'panjang dan lebar diisi berpasangan' },
        ),
    })
    .strict(),
  z
    .object({
      path: z.literal('water.source'),
      value: z.enum(['rooftop_tank', 'ground_tank', 'pump', 'municipal']),
    })
    .strict(),
  z
    .object({
      path: z.literal('water.installationType'),
      value: z.enum(['clean_water', 'drainage', 'both']),
    })
    .strict(),
  // Pekerjaan (P22-03): instalasi baru atau ganti pipa lama ke Pralon.
  z.object({ path: z.literal('water.replaceExisting'), value: z.boolean() }).strict(),
  // Renovasi (P23-03): jenis pekerjaan dan data pipa lama.
  z
    .object({
      path: z.literal('water.workType'),
      value: z.enum(['new', 'replace_all', 'replace_partial', 'extend']),
    })
    .strict(),
  z
    .object({
      path: z.literal('water.existingMainSize'),
      value: z.string().regex(/^(\d+(?: \d\/\d)?|\d\/\d)"$|^\d+(?:\.\d+)? mm$/),
    })
    .strict(),
  z
    .object({
      path: z.literal('water.existingPipeMaterial'),
      value: z.enum(['pvc', 'galvanized', 'hdpe', 'ppr']),
    })
    .strict(),
  z.object({ path: z.literal('water.existingOutlets'), value: count(1000) }).strict(),
  z.object({ path: z.literal('water.addedOutlets'), value: count(1000) }).strict(),
  z
    .object({
      path: z.literal('water.replacementLengthM'),
      value: z.number().min(0.1).max(100_000),
    })
    .strict(),
]);

export type RequirementEdit = z.infer<typeof RequirementEditSchema>;

export const EditDto = z.object({ edits: z.array(RequirementEditSchema).min(1).max(8) }).strict();
