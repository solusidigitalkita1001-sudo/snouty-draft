/**
 * Memuat katalog contoh dan kosakata dari `data/understanding/`. Berkas yang tidak valid
 * menggagalkan boot — contoh yang salah label lebih baik ketahuan saat deploy daripada diam
 * tidak pernah dikenali.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CatalogSchema, catalogIssues, type Catalog } from '../domain/catalog.js';
import { VocabularySchema, type Vocabulary } from '../domain/vocabulary.js';

export interface UnderstandingData {
  readonly catalogs: readonly Catalog[];
  readonly vocabulary: Vocabulary;
  readonly dir: string;
}

const VOCABULARY_FILE = 'vocabulary.json';

/** `data/understanding` dicari ke atas dari `from` — berlaku untuk `apps/api` maupun `/app/apps/api`. */
export function findDataDir(from: string = process.cwd()): string | null {
  let current = resolve(from);
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(current, 'data', 'understanding');
    if (existsSync(join(candidate, VOCABULARY_FILE))) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export function loadUnderstandingData(dir: string): UnderstandingData {
  const vocabulary = VocabularySchema.parse(readJson(join(dir, VOCABULARY_FILE)));
  const catalogs = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== VOCABULARY_FILE)
    .sort()
    .map((f) => {
      const catalog = CatalogSchema.parse(readJson(join(dir, f)));
      const issues = catalogIssues(catalog);
      if (issues.length > 0) {
        throw new Error(`data/understanding/${f} tidak valid:\n  ${issues.join('\n  ')}`);
      }
      return catalog;
    });
  return { catalogs, vocabulary, dir };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}
