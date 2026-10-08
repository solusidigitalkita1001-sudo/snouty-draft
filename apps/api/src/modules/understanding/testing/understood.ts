/**
 * Helper TES: pemahaman pesan yang ditentukan eksplisit — label (intent, kedalaman, format, topik,
 * aspek) diberikan tes, sedangkan kosakata entitas (keluarga produk, merek, hal-hal kebutuhan)
 * dibaca dari `data/understanding/vocabulary.json` yang asli, karena itu deterministik.
 *
 * Tes pipeline dengan ini menguji ATURAN BISNIS atas sebuah pemahaman ("bila dikenali sebagai
 * lanjutan dan tidak menyebut produk, subjek dilanjutkan"), bukan apakah penyandi mengenali
 * kalimatnya — itu diukur `understanding.eval.spec.ts` dengan penyandi sungguhan.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  understandingOf,
  type MessageUnderstanding,
} from '../application/message-understanding.js';
import type { FineIntent } from '../domain/labels.js';
import { EntityLexicon, VocabularySchema } from '../domain/vocabulary.js';
import { findDataDir } from '../infrastructure/catalog-files.js';

const dir = findDataDir();
if (!dir) throw new Error('data/understanding tidak ditemukan dari direktori kerja tes');

/** Kosakata entitas asli — sama dengan yang dimuat API. */
export const TEST_LEXICON = new EntityLexicon(
  VocabularySchema.parse(JSON.parse(readFileSync(join(dir, 'vocabulary.json'), 'utf8'))),
);

type Over = Partial<Omit<MessageUnderstanding, 'text' | 'intent'>> & {
  readonly intent?: FineIntent | null;
};

/** Pemahaman `text` dengan label yang ditentukan; entitas dari kosakata asli. */
export function understood(text: string, over: Over = {}): MessageUnderstanding {
  return understandingOf(text, {
    families: TEST_LEXICON.productFamilies(text),
    mentionsCompetitor: TEST_LEXICON.mentionsCompetitor(text),
    mentionsOwnBrand: TEST_LEXICON.mentionsOwnBrand(text),
    mentionsRequirement: TEST_LEXICON.mentionsRequirementEntity(text),
    mentionsOutOfScopeFluid: TEST_LEXICON.mentionsOutOfScopeFluid(text),
    ...over,
  });
}

/**
 * Layanan pemahaman TERSKRIP untuk tes orkestrasi: tiap pesan dipetakan ke labelnya (pesan yang
 * tidak ada di peta dipahami tanpa label — seperti kalimat yang tidak mirip contoh mana pun).
 */
export function scriptedUnderstanding(script: Readonly<Record<string, Over>>) {
  return {
    available: true,
    entities: TEST_LEXICON,
    understand: (text: string) => Promise.resolve(understood(text, script[text] ?? {})),
    knowledgeTopics: () => Promise.resolve([]),
    whenReady: () => Promise.resolve(),
  };
}
