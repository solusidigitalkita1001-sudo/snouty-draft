/**
 * Contoh rumah untuk layar sambutan (P22-01) dari `data/house-examples/examples.json`. Isinya
 * DATA — pemilik menambah contoh tanpa mengubah kode. Tiap nilai diperiksa dengan skema edit yang
 * sama dengan panel kanan, supaya tidak ada contoh yang lolos ke merger dengan nilai di luar batas.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { SCENE_ILLUSTRATIONS } from '@snouty/ui/illustrations';
import type { HouseExample } from '../domain/house-example.js';
import { RequirementEditSchema } from '../domain/requirement-edit.js';

const EXAMPLES_FILE = 'examples.json';

const Bilingual = z.object({ id: z.string().min(1), en: z.string().min(1) }).strict();

const HouseExampleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]{2,40}$/),
    image: z.enum(SCENE_ILLUSTRATIONS),
    label: Bilingual,
    summary: Bilingual,
    fields: z.array(RequirementEditSchema).min(3).max(12),
  })
  .strict();

const HouseExamplesFileSchema = z
  .object({ description: z.string().optional(), examples: z.array(HouseExampleSchema).max(20) })
  .strict();

/** `data/house-examples` dicari ke atas dari `from` — sama seperti `data/understanding`. */
export function findHouseExamplesDir(from: string = process.cwd()): string | null {
  let current = resolve(from);
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(current, 'data', 'house-examples');
    if (existsSync(join(candidate, EXAMPLES_FILE))) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export function loadHouseExamples(dir: string): readonly HouseExample[] {
  const raw: unknown = JSON.parse(readFileSync(join(dir, EXAMPLES_FILE), 'utf8'));
  const parsed = HouseExamplesFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`data/house-examples/${EXAMPLES_FILE} tidak valid:\n  ${issues.join('\n  ')}`);
  }
  const ids = new Set<string>();
  for (const example of parsed.data.examples) {
    if (ids.has(example.id)) throw new Error(`contoh rumah ganda: ${example.id}`);
    ids.add(example.id);
  }
  return parsed.data.examples satisfies readonly HouseExample[];
}

/** Contoh dari repo; kosong bila foldernya tidak ada (mis. image tanpa data) — layar tanpa contoh. */
export function houseExamplesFromRepo(from?: string): readonly HouseExample[] {
  const dir = findHouseExamplesDir(from);
  return dir === null ? [] : loadHouseExamples(dir);
}
