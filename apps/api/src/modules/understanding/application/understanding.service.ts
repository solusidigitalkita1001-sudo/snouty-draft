/**
 * UnderstandingService — memahami pesan dari CONTOH, bukan dari pola kalimat di kode.
 *
 * Saat boot, semua contoh di katalog data disandikan sekali (vektornya di-cache di berkas,
 * jadi boot berikutnya gratis). Per pesan: satu penyandian, lalu perbandingan kosinus dengan
 * seluruh contoh di setiap katalog. Di CPU server ini puluhan milidetik — bukan puluhan detik
 * model generatif — dan hasilnya bisa dijelaskan: "dikenali sebagai X karena mirip contoh Y".
 *
 * Yang tidak yakin dibiarkan `null`; pemanggil (router) yang memutuskan apakah model generatif
 * perlu dipanggil. Modul ini tidak tahu apa pun tentang katalog produk, kebutuhan, atau
 * aturan presedensi — itu milik `context`.
 */
import type { Logger } from 'pino';
import type { TextEncoder } from '../../ai/domain/text-encoder.port.js';
import { examplesOf, type Catalog } from '../domain/catalog.js';
import { decide, rank, type EmbeddedExample, type Verdict } from '../domain/classifier.js';
import type {
  CatalogName,
  CompanyTopicLabel,
  DepthLabel,
  FineIntent,
  FormatLabel,
  KnowledgeTopicLabel,
  ProductAspectLabel,
} from '../domain/labels.js';
import type { EntityLexicon } from '../domain/vocabulary.js';
import type { VectorCache } from '../infrastructure/file-vector.cache.js';
import { unavailableUnderstanding, type MessageUnderstanding } from './message-understanding.js';

const QUERY_CACHE_MAX = 500;

export class UnderstandingService {
  private readonly embedded = new Map<CatalogName, EmbeddedExample[]>();
  private readonly byName = new Map<CatalogName, Catalog>();
  private readonly queryCache = new Map<string, Float32Array>();
  private readonly readiness: Promise<void>;
  private ready = false;

  constructor(
    catalogs: readonly Catalog[],
    private readonly lexicon: EntityLexicon,
    private readonly encoder: TextEncoder | null,
    private readonly cache: VectorCache | null = null,
    private readonly logger: Logger | null = null,
  ) {
    for (const catalog of catalogs) this.byName.set(catalog.name as CatalogName, catalog);
    this.readiness = this.warmUp();
  }

  /** Apakah pemahaman semantik aktif (penyandi ada dan contoh sudah tersandi). */
  get available(): boolean {
    return this.ready;
  }

  /** Kosakata entitas (nama produk, merek, hal-hal kebutuhan) — deterministik, tanpa penyandi. */
  get entities(): EntityLexicon {
    return this.lexicon;
  }

  /** Menunggu penyandian contoh selesai; dipanggil pipeline sebelum pesan pertama. */
  whenReady(): Promise<void> {
    return this.readiness;
  }

  async understand(message: string): Promise<MessageUnderstanding> {
    await this.readiness;
    if (!this.ready) return unavailableUnderstanding(message, this.lexicon);
    let query: Float32Array;
    try {
      query = await this.encodeQuery(message);
    } catch (error) {
      // Penyandi tumbang di tengah jalan: giliran ini tanpa pemahaman semantik, bukan gagal.
      this.logger?.warn({ err: error }, 'penyandi teks tidak terjangkau');
      return unavailableUnderstanding(message, this.lexicon);
    }

    const intent = this.verdict('intent', query);
    const knowledge = this.verdict('knowledge-topic', query);
    return {
      text: message,
      available: true,
      intent: intent.best
        ? { label: intent.best.label as FineIntent, score: intent.best.score }
        : null,
      depth: (this.verdict('depth', query).best?.label as DepthLabel | undefined) ?? null,
      format: (this.verdict('format', query).best?.label as FormatLabel | undefined) ?? null,
      companyTopic:
        (this.verdict('company-topic', query).best?.label as CompanyTopicLabel | undefined) ?? null,
      productAspect:
        (this.verdict('product-aspect', query).best?.label as ProductAspectLabel | undefined) ??
        null,
      knowledgeTopics: knowledge.matched.map((m) => m.label as KnowledgeTopicLabel),
      families: this.lexicon.productFamilies(message),
      mentionsCompetitor: this.lexicon.mentionsCompetitor(message),
      mentionsOwnBrand: this.lexicon.mentionsOwnBrand(message),
      mentionsRequirement: this.lexicon.mentionsRequirementEntity(message),
      intentRanking: intent.ranked,
    };
  }

  /** Topik pengetahuan yang disinggung sebuah teks (mis. entitas subjek "pvc d dan pvc aw"). */
  async knowledgeTopics(text: string): Promise<readonly KnowledgeTopicLabel[]> {
    await this.readiness;
    if (!this.ready) return [];
    try {
      const query = await this.encodeQuery(text);
      return this.verdict('knowledge-topic', query).matched.map(
        (m) => m.label as KnowledgeTopicLabel,
      );
    } catch {
      return [];
    }
  }

  private verdict(name: CatalogName, query: Float32Array): Verdict {
    const catalog = this.byName.get(name);
    const examples = this.embedded.get(name);
    if (!catalog || !examples) return { best: null, matched: [], ranked: [] };
    return decide(catalog, rank(query, examples));
  }

  private async encodeQuery(message: string): Promise<Float32Array> {
    const key = message.trim().toLowerCase();
    const cached = this.queryCache.get(key);
    if (cached) return cached;
    const [vector] = await this.encoder!.encode([key]);
    if (!vector) throw new Error('penyandi tidak mengembalikan vektor');
    if (this.queryCache.size >= QUERY_CACHE_MAX) {
      const oldest = this.queryCache.keys().next().value;
      if (oldest !== undefined) this.queryCache.delete(oldest);
    }
    this.queryCache.set(key, vector);
    return vector;
  }

  private async warmUp(): Promise<void> {
    if (!this.encoder) {
      this.logger?.warn(
        'LLM_MODEL_EMBEDDING tidak diset: pemahaman pertanyaan jatuh ke model generatif',
      );
      return;
    }
    const started = Date.now();
    try {
      for (const catalog of this.byName.values()) {
        const examples = examplesOf(catalog);
        const vectors = await this.vectorsFor(examples.map((e) => e.text.toLowerCase()));
        this.embedded.set(
          catalog.name as CatalogName,
          examples.map((e, i) => ({ ...e, vector: vectors[i]! })),
        );
      }
      const flushed = (await this.cache?.flush()) ?? true;
      if (!flushed) {
        this.logger?.warn(
          { dir: this.cache?.dir },
          'cache vektor pemahaman tidak bisa ditulis — boot berikutnya menyandikan ulang',
        );
      }
      this.ready = true;
      this.logger?.info(
        {
          encoder: this.encoder.id,
          catalogs: [...this.byName.keys()],
          examples: [...this.embedded.values()].reduce((n, v) => n + v.length, 0),
          ms: Date.now() - started,
        },
        'contoh pemahaman tersandi',
      );
    } catch (error) {
      this.logger?.error({ err: error }, 'penyandian contoh pemahaman gagal');
    }
  }

  private async vectorsFor(texts: readonly string[]): Promise<readonly Float32Array[]> {
    const encoder = this.encoder!;
    const result: (Float32Array | undefined)[] = texts.map((t) => this.cache?.get(encoder.id, t));
    const missing = texts.map((t, i) => ({ t, i })).filter(({ i }) => result[i] === undefined);
    if (missing.length > 0) {
      const fresh = await encoder.encode(missing.map((m) => m.t));
      missing.forEach(({ t, i }, k) => {
        result[i] = fresh[k]!;
        this.cache?.set(encoder.id, t, fresh[k]!);
      });
    }
    return result as Float32Array[];
  }
}
