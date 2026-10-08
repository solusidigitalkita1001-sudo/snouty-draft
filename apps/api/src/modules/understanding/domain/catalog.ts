/**
 * Katalog contoh: satu berkas JSON per keputusan (intent, kedalaman, format, …), berisi label
 * dan kalimat-kalimat contohnya. Divalidasi saat dimuat; berkas yang salah menggagalkan boot,
 * bukan diam-diam melewatkan contoh.
 */
import { z } from 'zod';
import { CATALOG_LABELS } from './labels.js';

export const CatalogSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  description: z.string().optional(),
  /** Kemiripan kosinus minimum supaya label teratas dianggap cocok. */
  threshold: z.number().min(0).max(1),
  /** Selisih minimum label teratas atas label kedua; di bawahnya hasilnya "ragu". */
  margin: z.number().min(0).max(1).default(0),
  /** Beberapa label boleh cocok sekaligus (topik pengetahuan). */
  multi: z.boolean().default(false),
  labels: z.record(
    z.string().regex(/^[a-z][a-z0-9_ ]*$/),
    z.array(z.string().trim().min(1)).min(1),
  ),
});
export type Catalog = z.infer<typeof CatalogSchema>;

export interface Example {
  readonly label: string;
  readonly text: string;
}

export function examplesOf(catalog: Catalog): readonly Example[] {
  return Object.entries(catalog.labels).flatMap(([label, texts]) =>
    texts.map((text) => ({ label, text })),
  );
}

/**
 * Masalah yang membuat katalog ditolak: label yang tidak dikenal kode, dan contoh yang sama
 * di dua label (ia akan "cocok" ke keduanya dengan skor 1 — ambigu sejak lahir).
 */
export function catalogIssues(catalog: Catalog): readonly string[] {
  const issues: string[] = [];
  const known = CATALOG_LABELS[catalog.name];
  if (!known) {
    issues.push(`katalog "${catalog.name}" tidak dikenal kode`);
    return issues;
  }
  for (const label of Object.keys(catalog.labels)) {
    if (!known.includes(label))
      issues.push(`label "${label}" tidak dikenal di katalog "${catalog.name}"`);
  }
  const seen = new Map<string, string>();
  for (const { label, text } of examplesOf(catalog)) {
    const key = text.toLowerCase().trim();
    const other = seen.get(key);
    if (other && other !== label) {
      issues.push(`contoh "${text}" ada di label "${other}" dan "${label}"`);
    }
    seen.set(key, label);
  }
  return issues;
}
