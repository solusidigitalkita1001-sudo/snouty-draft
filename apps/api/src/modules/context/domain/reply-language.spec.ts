/** P25-01 — bahasa balasan mengikuti kalimat pengguna, bukan tombol bahasa. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EntityLexicon } from '../../understanding/domain/vocabulary.js';
import {
  findDataDir,
  loadUnderstandingData,
} from '../../understanding/infrastructure/catalog-files.js';
import { replyLanguageOf as detect } from './reply-language.js';

// Kosakata entitas yang sama dengan produksi: nama produk/merek disisihkan sebelum bahasa dikenali.
const lexicon = new EntityLexicon(loadUnderstandingData(findDataDir()!).vocabulary);
const replyLanguageOf = (text: string) => detect(text, (t) => lexicon.withoutNames(t));

const CASES = JSON.parse(
  readFileSync(new URL('../../../../evals/reply-language-cases.json', import.meta.url), 'utf8'),
) as { id: string[]; en: string[]; neutral: string[] };

describe('replyLanguageOf', () => {
  it.each([
    ...CASES.id.map((text) => [text, 'id'] as const),
    ...CASES.en.map((text) => [text, 'en'] as const),
  ])('%s → never answered in the other language', (text, language) => {
    const detected = replyLanguageOf(text);
    expect(detected === null || detected === language).toBe(true);
  });

  it('decides at least 90% of the labeled sentences (the rest keep the conversation language)', () => {
    const labeled = [...CASES.id, ...CASES.en];
    const decided = labeled.filter((text) => replyLanguageOf(text) !== null).length;
    expect(decided / labeled.length).toBeGreaterThanOrEqual(0.9);
  });

  it('the owner report: a short branded Indonesian question is not read as English', () => {
    expect(replyLanguageOf('pralon itu apa?')).toBe('id');
    expect(replyLanguageOf('what is pralon?')).toBe('en');
  });

  it('mixed messages: product names, sizes and English fitting names do not make it English', () => {
    expect(replyLanguageOf('elbow pvc 3 inch ada?')).not.toBe('en');
    expect(replyLanguageOf('tee pvc 2 inch ready?')).not.toBe('id');
  });

  it('leaves messages without language signal undecided', () => {
    expect(replyLanguageOf('ok')).toBeNull();
    expect(replyLanguageOf('4"')).toBeNull();
    expect(replyLanguageOf('   ')).toBeNull();
  });
});
