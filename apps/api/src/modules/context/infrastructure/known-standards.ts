/**
 * Daftar nomor standar yang dipegang SNOUTY sebagai DATA (`data/knowledge/standards.json`).
 * Standar baru ditambah di berkas itu tanpa menyentuh kode (P31-88).
 *
 * Berkas tidak ada → daftar kosong, dan daftar kosong berarti **setiap** nomor standar ditolak.
 * Itu arah gagal yang benar untuk sebuah pagar: tanpa daftar, tidak ada yang bisa dibuktikan.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { findDataDir } from '../../understanding/infrastructure/catalog-files.js';
import { normalizeStandard } from '../domain/standard-citations.js';

const StandardSchema = z
  .object({
    id: z.string().min(1),
    about: z.string().min(1),
    /** Dari mana SNOUTY mengenalnya — berkas data, tabel standar, atau sumber aturan hitung. */
    knownFrom: z.string().min(1),
  })
  .strict();

const FileSchema = z.object({
  $comment: z.string().optional(),
  standards: z.array(StandardSchema),
});

export type KnownStandard = z.infer<typeof StandardSchema>;

let cached: ReadonlySet<string> | null = null;

/** Nomor standar yang boleh disebut, dalam bentuk baku. */
export function knownStandards(): ReadonlySet<string> {
  if (cached !== null) return cached;
  const understanding = findDataDir();
  const file = understanding ? join(dirname(understanding), 'knowledge', 'standards.json') : null;
  const rows =
    file !== null && existsSync(file)
      ? FileSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).standards
      : [];
  cached = new Set(rows.map((row) => normalizeStandard(row.id)));
  return cached;
}
