/**
 * Jawaban pengetahuan dari DATA: fakta bersumber untuk topik yang dikenali (konsep di
 * `pipe-knowledge.ts` + `data/knowledge/pipe-facts.json`) ditambah data katalog yang dihitung saat
 * itu — jumlah produk dan rentang ukuran per keluarga, panjang per batang, kelas tekanan dari nama
 * produk, jumlah batang dari panjang jalur di pesan. Tidak ada jawaban per pertanyaan; yang
 * berubah mengikuti pesan adalah topik, keluarga, dan angkanya.
 */
import type { Locale } from '@snouty/shared-types';
import { productSizeOf, productTypesOf } from '../../product-catalog/domain/product-types.js';
import type { FamilyCount } from '../../product-catalog/domain/catalog.repository.js';
import { knowledgeFacts, type CatalogHook } from '../infrastructure/knowledge-facts.js';
import { conceptsFor } from './pipe-knowledge.js';

export interface KnowledgeCatalog {
  familyCounts(): Promise<readonly FamilyCount[]>;
  productNamesInFamily(family: string): Promise<readonly string[]>;
}

export interface KnowledgeAnswer {
  /** Jawaban siap tampil (mode hemat) — sekaligus DATA untuk model (mode kualitas). */
  readonly text: string;
  readonly topics: readonly string[];
}

const num = (n: number, locale: Locale) =>
  n.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });

const LENGTH = /x\s*(\d+(?:[.,]\d+)?)\s*Meter/i;
const PRESSURE = /\b(PN[- ]?\d+(?:[.,]\d+)?|SDR[- ]?\d+(?:[.,]\d+)?)\b/gi;
/** Panjang jalur di pesan ("27 meter", "60 m") — parser nilai, bukan pola pertanyaan. */
const ROUTE = /(\d+(?:[.,]\d+)?)\s*(?:m|meter|metres?|meters?)\b/i;

const decimal = (raw: string) => Number(raw.replace(',', '.'));

/**
 * `null` bila tidak ada fakta atau konsep untuk topik-topik ini (pemanggil memakai jalur lain).
 * Konsep kode dan fakta data untuk topik yang sama digabung, urut topik terdekat dulu.
 */
export async function knowledgeAnswer(
  topics: readonly string[],
  message: string,
  catalog: KnowledgeCatalog,
  locale: Locale,
): Promise<KnowledgeAnswer | null> {
  const en = locale === 'en';
  const facts = knowledgeFacts();
  const parts: string[] = [];
  const used: string[] = [];
  // Topik dengan fakta bersumber dulu (urutan terdekat tetap terjaga di dalamnya), lalu konsep
  // saja; paling banyak dua topik — topik ketiga hampir selalu tempelan.
  const withFacts: ReadonlySet<string> = new Set(facts.map((f) => f.topic));
  const ordered = [
    ...topics.filter((t) => withFacts.has(t)),
    ...topics.filter((t) => !withFacts.has(t)),
  ].slice(0, 2);
  for (const topic of ordered) {
    const concepts = conceptsFor([topic]).filter((c) => c.topic === topic);
    const own = facts.filter((f) => f.topic === topic);
    if (concepts.length === 0 && own.length === 0) continue;
    used.push(topic);
    for (const c of concepts) parts.push(en ? c.textEn : c.text);
    for (const f of own) {
      parts.push(en ? f.textEn : f.text);
      if (f.catalog) {
        const lines = await catalogLines(f.catalog, message, catalog, locale).catch(() => []);
        if (lines.length > 0) parts.push(lines.join('\n'));
      }
    }
  }
  if (parts.length === 0) return null;
  return { text: parts.join('\n\n'), topics: used };
}

async function catalogLines(
  hook: CatalogHook,
  message: string,
  catalog: KnowledgeCatalog,
  locale: Locale,
): Promise<string[]> {
  const en = locale === 'en';
  const counts = await catalog.familyCounts();
  const present = (hook.families ?? []).filter((f) => counts.some((c) => c.family === f));
  if (present.length === 0) return [];
  const lines: string[] = [];
  const route = hook.rods ? ROUTE.exec(message) : null;
  const routeM = route ? decimal(route[1]!) : null;
  if (hook.rods && routeM === null) return [];
  lines.push(en ? 'In the active Pralon catalogue:' : 'Di katalog Pralon yang aktif:');
  for (const family of present) {
    const all = await catalog.productNamesInFamily(family);
    const only = hook.nameIncludes?.[family];
    const names = only ? all.filter((n) => n.toLowerCase().includes(only.toLowerCase())) : all;
    if (names.length === 0) continue;
    const lengths = [
      ...new Set(
        names
          .map((n) => LENGTH.exec(n)?.[1])
          .filter((l): l is string => l !== undefined)
          .map(decimal),
      ),
    ].sort((a, b) => a - b);
    if (hook.rods && routeM !== null && lengths.length > 0) {
      const options = lengths
        .filter((l) => l > 0 && l < 50)
        .map((l) =>
          en
            ? `${num(l, locale)} m pipe → ${Math.ceil(routeM / l)} pipes`
            : `batang ${num(l, locale)} m → ${Math.ceil(routeM / l)} batang`,
        );
      if (options.length > 0) {
        lines.push(
          en
            ? `- **${family}** for ${num(routeM, locale)} m: ${options.join('; ')}`
            : `- **${family}** untuk ${num(routeM, locale)} m: ${options.join('; ')}`,
        );
      }
      continue;
    }
    const sizes = names
      .map((n) => productSizeOf(n))
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.mm - b.mm);
    const range =
      sizes.length > 0
        ? sizes[0]!.label === sizes[sizes.length - 1]!.label
          ? sizes[0]!.label
          : `${sizes[0]!.label}–${sizes[sizes.length - 1]!.label}`
        : null;
    const details: string[] = [
      en ? `${num(names.length, locale)} products` : `${num(names.length, locale)} produk`,
    ];
    if (range) details.push(en ? `sizes ${range}` : `ukuran ${range}`);
    if (hook.lengths && lengths.length > 0) {
      details.push(
        en
          ? `lengths ${lengths.map((l) => `${num(l, locale)} m`).join(', ')}`
          : `panjang ${lengths.map((l) => `${num(l, locale)} m`).join(', ')}`,
      );
    }
    if (hook.pressure) {
      const classes = [
        ...new Set(
          names.flatMap((n) =>
            [...n.matchAll(PRESSURE)].map((m) => m[1]!.toUpperCase().replace(' ', '-')),
          ),
        ),
      ];
      if (classes.length > 0) {
        details.push(en ? `classes ${classes.join(', ')}` : `kelas ${classes.join(', ')}`);
      }
    }
    if (hook.types) {
      const types = productTypesOf(names)
        .slice(0, 6)
        .map((t) => t.type);
      if (types.length > 0)
        details.push(en ? `types: ${types.join(', ')}` : `jenis: ${types.join(', ')}`);
    }
    lines.push(`- **${family}** — ${details.join(' · ')}`);
  }
  return lines.length > 1 ? lines : [];
}

/** Nilai tekanan dalam bar di pesan ("10 bar", "8-12 bar") — parser nilai, bukan pola pertanyaan. */
export function mentionsPressure(message: string): boolean {
  return PRESSURE_VALUE.test(message);
}
const PRESSURE_VALUE = /\d+(?:[.,]\d+)?\s*(?:(?:-|–|sampai|s\/d)\s*\d+(?:[.,]\d+)?\s*)?bar\b/i;
