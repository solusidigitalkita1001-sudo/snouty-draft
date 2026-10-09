/**
 * Ragam produk Pralon — "produk Pralon apa aja?" dan "HDPE di Pralon jenisnya apa aja?".
 *
 * Dihitung dari SELURUH katalog aktif lewat ringkasan repository (jumlah per keluarga, nama per
 * keluarga), bukan dari halaman produk pertama. Dulu ikhtisar membaca 50 produk pertama: 8 dari
 * 24 keluarga, "HDPE 23 produk" padahal 1.327, dan PVC AW tidak muncul sama sekali (katalog
 * produksi 7.681 produk, verifikasi 2026-10-09).
 *
 * Jenis dalam satu keluarga dibaca dari nama produk (`productTypesOf`). Semua angka di sini
 * adalah hitungan katalog, bukan perkiraan.
 */
import {
  DEFAULT_LOCALE,
  type AssistantCard,
  type CatalogVersion,
  type Locale,
} from '@snouty/shared-types';
import { CatalogUnavailableError } from '../../product-catalog/domain/catalog.errors.js';
import type { FamilyCount } from '../../product-catalog/domain/catalog.repository.js';
import { productTypesOf, type ProductType } from '../../product-catalog/domain/product-types.js';
import { MATERIALS } from './pipe-knowledge.js';
import { productAnswerCopy } from './product-answer-text.js';

export interface RangeCatalog {
  activeVersion(): Promise<CatalogVersion>;
  familyCounts(): Promise<readonly FamilyCount[]>;
  productNamesInFamily(family: string): Promise<readonly string[]>;
}

export type RangeFormat = 'table' | 'bullets' | 'summary' | null;

export interface RangeOutcome {
  readonly text: string;
  readonly cards: readonly AssistantCard[];
}

/** Jenis yang ditampilkan per keluarga pipa; sisanya disebut jumlahnya. */
const MAX_TYPES = 8;
/** Contoh jenis untuk keluarga fitting (ratusan jenis) dan untuk keluarga dalam grup. */
const FITTING_EXAMPLES = 3;
const FITTING = /^FITTING\b/i;

function isAuthoritative(version: CatalogVersion): boolean {
  return version.kind === 'pralon';
}

async function countsFrom(catalog: RangeCatalog): Promise<readonly FamilyCount[] | null> {
  try {
    if (!isAuthoritative(await catalog.activeVersion())) return null;
    const counts = await catalog.familyCounts();
    return counts.length > 0 ? counts : null;
  } catch (error) {
    if (error instanceof CatalogUnavailableError) return null;
    throw error;
  }
}

const number = (n: number, locale: Locale) => n.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID');

function products(n: number, locale: Locale): string {
  const value = number(n, locale);
  return locale === 'en' ? `${value} ${n === 1 ? 'product' : 'products'}` : `${value} produk`;
}

function joinNatural(items: readonly string[], locale: Locale): string {
  const and = locale === 'en' ? 'and' : 'dan';
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} ${and} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${and} ${items.at(-1)}`;
}

const cell = (text: string) => text.replace(/\|/g, '\\|');

/**
 * Keluarga yang berbagi kata pertama digabung satu baris ("PVC — AW, D, VP, …"): 17 keluarga PVC
 * sebagai 17 baris tidak terbaca di chat. Fitting tetap per keluarga.
 */
function grouped(
  counts: readonly FamilyCount[],
): { label: string; total: number; members: readonly FamilyCount[] }[] {
  const byHead = new Map<string, FamilyCount[]>();
  for (const c of counts) {
    const head = FITTING.test(c.family) ? c.family : (c.family.split(/\s+/)[0] ?? c.family);
    byHead.set(head, [...(byHead.get(head) ?? []), c]);
  }
  return [...byHead.entries()].map(([head, members]) => ({
    label: members.length > 1 ? head : members[0]!.family,
    total: members.reduce((sum, m) => sum + m.count, 0),
    members,
  }));
}

/** "produk Pralon apa aja?" — seluruh keluarga katalog aktif, dengan jumlah sebenarnya. */
export async function rangeOverview(
  catalog: RangeCatalog,
  locale: Locale = DEFAULT_LOCALE,
  format: RangeFormat = null,
): Promise<RangeOutcome> {
  const COPY = productAnswerCopy(locale);
  const en = locale === 'en';
  const counts = await countsFrom(catalog);
  if (counts === null) return notInstalled(locale);

  const total = counts.reduce((sum, c) => sum + c.count, 0);
  if (format === 'table') {
    const rows = counts.map((c) => `| ${cell(c.family)} | ${number(c.count, locale)} |`);
    const table = [
      en ? '| Family | Products |' : '| Keluarga | Jumlah produk |',
      '| --- | --- |',
      ...rows,
    ].join('\n');
    return { text: [table, '', COPY.rangeNext].join('\n'), cards: [] };
  }

  const groups = grouped(counts);
  const pipes = groups.filter((g) => !FITTING.test(g.label));
  const fittings = groups.filter((g) => FITTING.test(g.label));
  const intro = en
    ? `The active Pralon catalogue has ${products(total, locale)} in ${counts.length} families.`
    : `Katalog Pralon yang aktif memuat ${products(total, locale)} dalam ${counts.length} keluarga.`;

  if (format === 'summary') {
    const pipeNames = pipes.map((g) => g.label);
    const fittingNames = fittings.map((g) => g.label);
    const text = en
      ? `${intro} Pipes: ${joinNatural(pipeNames, locale)}; fittings: ${joinNatural(fittingNames, locale)}.`
      : `${intro} Pipanya ${joinNatural(pipeNames, locale)}; fittingnya ${joinNatural(fittingNames, locale)}.`;
    return { text: [text, '', COPY.rangeNext].join('\n'), cards: [] };
  }

  const line = (g: (typeof groups)[number]) => {
    const head = `- **${g.label}** — ${products(g.total, locale)}`;
    if (g.members.length === 1) return head;
    const prefix = new RegExp(`^${g.label}\\s+`, 'i');
    return `${head}: ${g.members.map((m) => m.family.replace(prefix, '')).join(', ')}`;
  };
  const lines = [
    intro,
    '',
    en ? 'Pipes:' : 'Pipa:',
    '',
    ...pipes.map(line),
    ...(fittings.length > 0 ? ['', en ? 'Fittings:' : 'Fitting:', '', ...fittings.map(line)] : []),
    '',
    COPY.rangeNext,
  ];
  return { text: lines.join('\n'), cards: [] };
}

/**
 * Keluarga katalog untuk satu keluarga yang disebut pesan ("hdpe" → HDPE, FITTING HDPE;
 * "pvc aw" → PVC AW; "pvc" → seluruh keluarga PVC). Cocok bila semua kata kunci ada di nama.
 */
export function matchingFamilies(
  counts: readonly FamilyCount[],
  mentioned: readonly string[],
): readonly FamilyCount[] {
  const words = (s: string) => s.toUpperCase().split(/\s+/).filter(Boolean);
  return counts.filter((c) => {
    const family = words(c.family);
    return mentioned.some((m) => words(m).every((w) => family.includes(w)));
  });
}

/**
 * "HDPE di Pralon jenisnya apa aja?" — jenis-jenis dalam keluarga yang disebut, dari katalog.
 * `null` bila katalog Pralon belum terpasang atau keluarganya tidak ada di katalog: pemanggil
 * kembali ke jalur penjelasan bahan.
 */
export async function familyRange(
  catalog: RangeCatalog,
  mentioned: readonly string[],
  locale: Locale = DEFAULT_LOCALE,
  format: RangeFormat = null,
): Promise<RangeOutcome | null> {
  const COPY = productAnswerCopy(locale);
  const en = locale === 'en';
  const counts = await countsFrom(catalog);
  if (counts === null) return null;
  const families = matchingFamilies(counts, mentioned);
  if (families.length === 0) return null;

  const pipes = families.filter((f) => !FITTING.test(f.family));
  const fittings = families.filter((f) => FITTING.test(f.family));
  const typesOf = async (family: string) =>
    productTypesOf(await catalog.productNamesInFamily(family));

  const parts: string[] = [];
  if (pipes.length === 1) {
    const family = pipes[0]!;
    const types = await typesOf(family.family);
    if (format === 'table') {
      parts.push(typeTable(types, locale));
    } else {
      parts.push(
        en
          ? `The Pralon catalogue has ${products(family.count, locale)} in the ${family.family} family, in these types:`
          : `Di katalog Pralon, keluarga ${family.family} ada ${products(family.count, locale)}, terbagi dalam jenis berikut:`,
        '',
        ...types.slice(0, MAX_TYPES).map((t) => typeLine(t, locale)),
      );
      const rest = types.length - MAX_TYPES;
      if (rest > 0) {
        parts.push(en ? `- and ${rest} other types` : `- dan ${rest} jenis lainnya`);
      }
    }
  } else if (pipes.length > 1) {
    const total = pipes.reduce((sum, f) => sum + f.count, 0);
    const rows = await Promise.all(
      pipes.map(async (f) => ({ family: f, types: await typesOf(f.family) })),
    );
    if (format === 'table') {
      parts.push(
        en ? '| Family | Products | Main types |' : '| Keluarga | Jumlah produk | Jenis utama |',
        '| --- | --- | --- |',
        ...rows.map(
          (r) =>
            `| ${cell(r.family.family)} | ${number(r.family.count, locale)} | ${cell(
              r.types
                .slice(0, FITTING_EXAMPLES)
                .map((t) => t.type)
                .join('; '),
            )} |`,
        ),
      );
    } else {
      parts.push(
        en
          ? `The Pralon catalogue has ${products(total, locale)} across ${pipes.length} families:`
          : `Di katalog Pralon ada ${products(total, locale)} dalam ${pipes.length} keluarga:`,
        '',
        ...rows.map(
          (r) =>
            `- **${r.family.family}** — ${products(r.family.count, locale)}, ${en ? 'e.g.' : 'misalnya'} ${joinNatural(
              r.types.slice(0, 2).map((t) => t.type),
              locale,
            )}`,
        ),
      );
    }
  }

  for (const f of fittings) {
    const examples = (await typesOf(f.family)).slice(0, FITTING_EXAMPLES).map((t) => t.type);
    parts.push(
      '',
      en
        ? `${f.family}: ${products(f.count, locale)}, including ${joinNatural(examples, locale)}.`
        : `${f.family} ada ${products(f.count, locale)}, di antaranya ${joinNatural(examples, locale)}.`,
    );
  }

  parts.push('', COPY.familyNext);
  return { text: parts.join('\n').replace(/^\n+/, ''), cards: [] };
}

function typeLine(t: ProductType, locale: Locale): string {
  const pn =
    t.pressureClasses.length === 0
      ? ''
      : t.pressureClasses.length === 1
        ? `${t.pressureClasses[0]}, `
        : locale === 'en'
          ? `${t.pressureClasses[0]} to ${t.pressureClasses.at(-1)}, `
          : `${t.pressureClasses[0]} sampai ${t.pressureClasses.at(-1)}, `;
  return `- **${t.type}** — ${pn}${products(t.count, locale)}`;
}

function typeTable(types: readonly ProductType[], locale: Locale): string {
  const en = locale === 'en';
  return [
    en ? '| Type | Pressure classes | Products |' : '| Jenis | Kelas tekanan | Jumlah produk |',
    '| --- | --- | --- |',
    ...types.map(
      (t) =>
        `| ${cell(t.type)} | ${t.pressureClasses.join(', ') || '—'} | ${number(t.count, locale)} |`,
    ),
  ].join('\n');
}

/** Katalog Pralon belum terpasang: jujur, lalu ragam bahan umum dari pengetahuan milik kode. */
function notInstalled(locale: Locale): RangeOutcome {
  const COPY = productAnswerCopy(locale);
  const families = MATERIALS.map(
    (m) => `- **${m.label}** — ${m.gist}; lazim untuk ${m.typicalUse}.`,
  );
  return {
    text: [COPY.catalogNotInstalled, '', ...families, '', COPY.askTechnicalForProducts].join('\n'),
    cards: [{ kind: 'cta', action: 'CONTACT_TECHNICAL' }],
  };
}

/** Jawaban asisten sebelumnya adalah ikhtisar ragam / jenis keluarga (penanda: teks tetap milik kode). */
export function previousRange(lastAssistantText: string): 'overview' | 'family' | null {
  for (const l of ['id', 'en'] as const) {
    const copy = productAnswerCopy(l);
    if (lastAssistantText.includes(copy.familyNext)) return 'family';
    if (
      lastAssistantText.includes(copy.rangeNext) ||
      lastAssistantText.includes(copy.catalogNotInstalled)
    ) {
      return 'overview';
    }
  }
  return null;
}
