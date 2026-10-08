/**
 * UnderstandingService: contoh disandikan sekali (cache vektor dipakai ulang), satu penyandian per
 * pesan, keputusan per katalog mengikuti ambang; tanpa penyandi atau saat penyandi tumbang,
 * pemahaman kosong tetapi kosakata tetap terisi — giliran tidak pernah gagal karena ini.
 */
import { describe, expect, it } from 'vitest';
import type { TextEncoder } from '../../ai/domain/text-encoder.port.js';
import { CatalogSchema } from '../domain/catalog.js';
import { EntityLexicon, VocabularySchema } from '../domain/vocabulary.js';
import type { VectorCache } from '../infrastructure/file-vector.cache.js';
import { UnderstandingService } from './understanding.service.js';

/** Penyandi palsu: satu dimensi per kata yang dikenal — kemiripan = kata yang sama. */
class WordEncoder implements TextEncoder {
  readonly id = 'word-v1';
  calls: string[][] = [];
  private readonly words = ['hai', 'makasih', 'lengkap', 'dong', 'tabel', 'pvc', 'hdpe', 'apa'];
  encode(texts: readonly string[]): Promise<readonly Float32Array[]> {
    this.calls.push([...texts]);
    return Promise.resolve(
      texts.map((t) => {
        const v = new Float32Array(this.words.length);
        for (const w of t.toLowerCase().split(/\s+/)) {
          const i = this.words.indexOf(w);
          if (i >= 0) v[i] = 1;
        }
        const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        return len > 0 ? v.map((x) => x / len) : v;
      }),
    );
  }
}

const catalogs = [
  CatalogSchema.parse({
    name: 'intent',
    threshold: 0.7,
    margin: 0.05,
    labels: { greeting: ['hai'], thanks: ['makasih'], follow_up_more: ['lengkap dong'] },
  }),
  CatalogSchema.parse({
    name: 'format',
    threshold: 0.7,
    labels: { table: ['tabel'] },
  }),
];
const lexicon = new EntityLexicon(
  VocabularySchema.parse({
    ownBrand: ['pralon'],
    productFamilies: { pvc: ['pvc'], hdpe: ['hdpe'] },
    competitorBrands: [],
    competitorReferences: [],
    requirementEntities: ['rumah'],
  }),
);

describe('UnderstandingService', () => {
  it('mengenali dari contoh; yang tidak mirip apa pun dibiarkan null; kosakata selalu terisi', async () => {
    const service = new UnderstandingService(catalogs, lexicon, new WordEncoder());
    await service.whenReady();
    expect(service.available).toBe(true);

    const thanks = await service.understand('makasih');
    expect(thanks.intent?.label).toBe('thanks');
    expect(thanks.intentRanking[0]?.example).toBe('makasih');

    const more = await service.understand('lengkap dong');
    expect(more.intent?.label).toBe('follow_up_more');
    expect(more.format).toBeNull();

    const table = await service.understand('tabel');
    expect(table.format).toBe('table');
    expect(table.intent).toBeNull(); // tidak mirip contoh intent mana pun
    expect((await service.understand('pvc hdpe')).families).toEqual(['pvc', 'hdpe']);

    const unknown = await service.understand('rumah apa');
    expect(unknown.intent).toBeNull();
    expect(unknown.mentionsRequirement).toBe(true);
  });

  it('dua label sama miripnya → ragu (margin), bukan menebak', async () => {
    const service = new UnderstandingService(catalogs, lexicon, new WordEncoder());
    const u = await service.understand('hai makasih');
    expect(u.intent).toBeNull();
    expect(
      u.intentRanking
        .slice(0, 2)
        .map((r) => r.label)
        .sort(),
    ).toEqual(['greeting', 'thanks']);
  });

  it('contoh disandikan sekali saat boot; pesan yang sama tidak disandikan dua kali', async () => {
    const encoder = new WordEncoder();
    const service = new UnderstandingService(catalogs, lexicon, encoder);
    await service.whenReady();
    const boot = encoder.calls.length;
    await service.understand('Makasih');
    await service.understand('makasih ');
    expect(encoder.calls.length).toBe(boot + 1);
  });

  it('cache vektor: vektor yang sudah ada tidak diminta lagi ke penyandi, yang baru disimpan', async () => {
    const stored = new Map<string, Float32Array>();
    const cache: VectorCache = {
      get: (id, text) => stored.get(`${id}:${text}`),
      set: (id, text, v) => void stored.set(`${id}:${text}`, v),
      flush: () => Promise.resolve(),
    };
    const first = new WordEncoder();
    await new UnderstandingService(catalogs, lexicon, first, cache).whenReady();
    expect(stored.size).toBe(4);
    const second = new WordEncoder();
    await new UnderstandingService(catalogs, lexicon, second, cache).whenReady();
    expect(second.calls).toEqual([]);
  });

  it('tanpa penyandi: tidak tersedia, pemahaman kosong, kosakata tetap', async () => {
    const service = new UnderstandingService(catalogs, lexicon, null);
    await service.whenReady();
    expect(service.available).toBe(false);
    const u = await service.understand('makasih pvc');
    expect(u.available).toBe(false);
    expect(u.intent).toBeNull();
    expect(u.families).toEqual(['pvc']);
    expect(service.entities).toBe(lexicon);
  });

  it('penyandi tumbang di tengah jalan: giliran itu tanpa pemahaman semantik, bukan lemparan', async () => {
    const encoder = new WordEncoder();
    const service = new UnderstandingService(catalogs, lexicon, encoder);
    await service.whenReady();
    encoder.encode = () => Promise.reject(new Error('ollama mati'));
    const u = await service.understand('makasih');
    expect(u.available).toBe(false);
    expect(u.intent).toBeNull();
    expect(await service.knowledgeTopics('apa')).toEqual([]);
  });
});
