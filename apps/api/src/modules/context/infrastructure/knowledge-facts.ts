/**
 * Fakta pengetahuan pipa sebagai DATA (`data/knowledge/pipe-facts.json`) — jawaban dirangkai dari
 * fakta bersumber dan data katalog yang dihitung saat itu, bukan teks jawaban per pertanyaan
 * (pemilik 2026-10-09: "jangan dibikin static"). Fakta baru ditambah di file itu tanpa kode.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { findDataDir } from '../../understanding/infrastructure/catalog-files.js';
import { KNOWLEDGE_TOPICS } from '../../understanding/domain/labels.js';

const CatalogHookSchema = z
  .object({
    families: z.array(z.string().min(1)).optional(),
    lengths: z.boolean().optional(),
    pressure: z.boolean().optional(),
    rods: z.boolean().optional(),
    /** Jenis produk per keluarga dari nama produk ("Pipa HDPE Gas", "Pipa HDPE Telkom"). */
    types: z.boolean().optional(),
    /** Saring nama produk per keluarga: { "HDPE": "gas" }. */
    nameIncludes: z.record(z.string(), z.string().min(1)).optional(),
  })
  .strict();

const FactSchema = z
  .object({
    topic: z.enum(KNOWLEDGE_TOPICS),
    text: z.string().min(1),
    textEn: z.string().min(1),
    source: z.string().min(1),
    catalog: CatalogHookSchema.optional(),
  })
  .strict();

const FactsFileSchema = z.object({ $comment: z.string().optional(), facts: z.array(FactSchema) });

export type KnowledgeFact = z.infer<typeof FactSchema>;
export type CatalogHook = z.infer<typeof CatalogHookSchema>;

let cached: readonly KnowledgeFact[] | null = null;

/** Fakta dari `data/knowledge/pipe-facts.json`; berkas tidak ada → tanpa fakta (bukan galat). */
export function knowledgeFacts(): readonly KnowledgeFact[] {
  if (cached !== null) return cached;
  const understanding = findDataDir();
  const file = understanding ? join(dirname(understanding), 'knowledge', 'pipe-facts.json') : null;
  cached =
    file !== null && existsSync(file)
      ? FactsFileSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).facts
      : [];
  return cached;
}

/** Topik yang punya fakta data — jalur pengetahuan didahulukan untuk topik ini. */
export function factTopics(): ReadonlySet<string> {
  return new Set(knowledgeFacts().map((f) => f.topic));
}
