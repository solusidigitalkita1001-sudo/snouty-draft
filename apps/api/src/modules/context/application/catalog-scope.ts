/**
 * Pencarian sadar-kategori untuk FITTING (audit 2026-10-09, kasus "apa bedanya fitting pvc dan
 * fitting hdpe?" yang dijawab perbandingan PIPA dengan contoh produk pipa).
 *
 * Akar masalahnya: kosakata pemahaman hanya mengenal BAHAN (pvc, hdpe) — "fitting" bukan keluarga
 * — lalu contoh produk diambil dengan pencarian teks bebas tanpa filter kategori. Katalog ERP sudah
 * punya taksonomi resmi: `family` (FITTING PVC, FITTING HDPE, …) dan `category` ("FITTING · ELBOW
 * 45°", "FITTING · TEE", …). Modul ini memakainya sebagai filter TERSTRUKTUR:
 *   - lingkup = keluarga katalog yang disebut pesan (nama keluarga = data katalog), atau keluarga
 *     subjek aktif untuk lanjutan tanpa keluarga baru ("kalau ukuran 110 mm?");
 *   - jenis fitting ("elbow") dari kosakata `fittingFamilies` + sinonimnya → `categoryIncludes`;
 *   - ukuran dari parser nilai → filter tabel ukuran;
 *   - tidak ada hasil → dikatakan, TIDAK diganti kategori lain.
 * Pengetahuan umum (cara sambung bahan) diberi label "secara umum", terpisah dari data katalog.
 */
import { PipeSize, specHasValue, type Locale, type Product } from '@snouty/shared-types';
import type { CategoryCount } from '../../product-catalog/domain/catalog.repository.js';
import type { PublicProductListQuery } from '../../product-catalog/application/catalog-query.service.js';
import type { ProductListPage } from '../../product-catalog/domain/catalog.repository.js';
import { MATERIALS } from './pipe-knowledge.js';
import { productAnswerCopy } from './product-answer-text.js';
import { familiesInMessage, type RangeCatalog } from './product-range.js';

export interface ScopeCatalog extends RangeCatalog {
  categoryCounts(family: string): Promise<readonly CategoryCount[]>;
  listProducts(query: PublicProductListQuery): Promise<ProductListPage>;
}

export interface FittingQuery {
  readonly message: string;
  /** Jenis fitting yang disebut beserta sinonimnya, urutan prioritas: ["elbow", "knee", "bend"…]. */
  readonly kindTerms: readonly string[];
  /** Ukuran dari parser nilai ("110 mm", "3/4"), `null` bila tidak disebut. */
  readonly size: string | null;
  readonly locale: Locale;
}

export interface FittingOutcome {
  readonly text: string;
  /** Produk katalog yang benar-benar terambil — untuk kartu; kosong bila tidak ada. */
  readonly products: readonly Product[];
  /** Keluarga yang dibicarakan — menjadi subjek lanjutan. */
  readonly families: readonly string[];
}

const FITTING = /^FITTING\b/i;
const SHOWN = 6;
const TOP_CATEGORIES = 5;

/**
 * Keluarga katalog yang menjadi lingkup giliran ini: yang disebut pesan; bila pesan tidak menyebut
 * keluarga apa pun, keluarga subjek aktif (lanjutan "kalau ukuran 110 mm?").
 */
export function catalogScope(
  message: string,
  subjectEntity: string | null,
  families: readonly string[],
): string[] {
  const named = familiesInMessage(message, families);
  if (named.length > 0) return named;
  return subjectEntity ? familiesInMessage(subjectEntity, families) : [];
}

/** "FITTING · ELBOW 45°" → "Elbow 45°"; singkatan pendek ("TY") tetap kapital. */
export function fittingTypeLabel(category: string): string {
  const bare = category.replace(/^FITTING\s*[·•\-–]?\s*/i, '').trim();
  return bare
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}

function materialOf(family: string) {
  return MATERIALS.find((m) => family.toUpperCase().split(/\s+/).includes(m.family.toUpperCase()));
}

const number = (n: number, locale: Locale) => n.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID');

/**
 * Jawaban untuk lingkup yang memuat keluarga FITTING; `null` bila lingkupnya bukan fitting atau
 * katalog tidak terbaca — pemanggil memakai jalur lama.
 */
export async function fittingAnswer(
  catalog: ScopeCatalog,
  scope: readonly string[],
  query: FittingQuery,
): Promise<FittingOutcome | null> {
  const fittings = scope.filter((f) => FITTING.test(f));
  if (fittings.length === 0) return null;
  try {
    if (query.kindTerms.length > 0 || query.size !== null) {
      return await fittingLookup(catalog, fittings, query);
    }
    if (fittings.length >= 2) return await fittingComparison(catalog, fittings, query.locale);
    return await fittingTypes(catalog, fittings[0]!, query.locale);
  } catch {
    return null;
  }
}

/** Pencarian terfilter: keluarga + jenis (kategori resmi) + ukuran (tabel ukuran). */
async function fittingLookup(
  catalog: ScopeCatalog,
  fittings: readonly string[],
  query: FittingQuery,
): Promise<FittingOutcome> {
  const en = query.locale === 'en';
  const size = query.size !== null ? PipeSize.parse(query.size) : null;
  const found: Product[] = [];
  let matchedKind: string | null = null;
  for (const family of fittings) {
    const terms = query.kindTerms.length > 0 ? query.kindTerms : [null];
    for (const term of terms) {
      const page = await catalog.listProducts({
        family,
        status: 'active',
        limit: SHOWN,
        ...(term !== null ? { categoryIncludes: term } : {}),
        ...(size !== null ? { size } : {}),
      });
      if (page.items.length > 0) {
        found.push(...page.items);
        matchedKind = term;
        break;
      }
    }
  }

  const what = [
    fittings.join(en ? ' and ' : ' dan '),
    query.kindTerms.length > 0
      ? en
        ? `type ${query.kindTerms[0]}`
        : `jenis ${query.kindTerms[0]}`
      : null,
    query.size !== null ? (en ? `size ${query.size}` : `ukuran ${query.size}`) : null,
  ]
    .filter(Boolean)
    .join(', ');

  if (found.length === 0) {
    // Tidak diganti kategori atau ukuran lain diam-diam — pengguna yang memutuskan.
    return {
      products: [],
      families: fittings,
      text: en
        ? `I could not find ${what} in the active Pralon catalogue. Shall I show the sizes that are available for it, or another fitting type for this size?`
        : `Di katalog Pralon yang aktif belum ada ${what}. Mau saya tampilkan ukuran yang tersedia, atau jenis fitting lain untuk ukuran ini?`,
    };
  }

  const shown = found.slice(0, SHOWN);
  const lines = shown.map((p) => {
    const pn = specHasValue(p.pressureClass)
      ? en
        ? ` — pressure class ${p.pressureClass.value}`
        : ` — kelas tekanan ${p.pressureClass.value}`
      : '';
    return `- ${p.name}${pn}`;
  });
  const kindNote =
    matchedKind !== null && matchedKind !== query.kindTerms[0]
      ? en
        ? ` (listed in the catalogue as ${matchedKind})`
        : ` (di katalog tercatat sebagai ${matchedKind})`
      : '';
  return {
    products: shown,
    families: fittings,
    text: [
      en
        ? `${what} in the Pralon catalogue${kindNote}, for example:`
        : `${capitalize(what)} di katalog Pralon${kindNote}, contohnya:`,
      '',
      ...lines,
      '',
      en
        ? 'Pressure is only stated where the catalogue records it.'
        : 'Kelas tekanan hanya disebut bila tercatat di katalog.',
    ].join('\n'),
  };
}

/** Perbandingan dua keluarga fitting: prinsip umum (cara sambung bahan) + data katalog masing-masing. */
async function fittingComparison(
  catalog: ScopeCatalog,
  fittings: readonly string[],
  locale: Locale,
): Promise<FittingOutcome> {
  const en = locale === 'en';
  const counts = await catalog.familyCounts();
  const general = fittings
    .map((family) => {
      const m = materialOf(family);
      if (!m) return null;
      const joining = en ? m.en.joining : m.joining;
      return `- **${fittingTitle(family, en)}** — ${en ? 'joined like its pipe:' : 'disambung seperti pipanya:'} ${joining}.`;
    })
    .filter((l): l is string => l !== null);
  const catalogLines = await Promise.all(
    fittings.map(async (family) => {
      const total = counts.find((c) => c.family === family)?.count ?? 0;
      const top = (await catalog.categoryCounts(family))
        .slice(0, TOP_CATEGORIES)
        .map((c) => fittingTypeLabel(c.category));
      return en
        ? `- **${family}** — ${number(total, locale)} active SKUs; most common types: ${top.join(', ')}`
        : `- **${family}** — ${number(total, locale)} SKU aktif; jenis terbanyak: ${top.join(', ')}`;
    }),
  );
  const text = [
    en
      ? `The main difference between ${fittings.map((f) => fittingTitle(f, en)).join(' and ')} is how they are joined, which follows the pipe material they belong to.`
      : `Beda utama ${fittings.map((f) => fittingTitle(f, en)).join(' dan ')} ada di cara penyambungannya, yang mengikuti bahan pipanya.`,
    '',
    en ? 'In general:' : 'Secara umum:',
    '',
    ...general,
    '',
    en ? 'In the active Pralon catalogue:' : 'Di katalog Pralon yang aktif:',
    '',
    ...catalogLines,
    '',
    productAnswerCopy(locale).familyNext,
  ].join('\n');
  return { text, products: [], families: fittings };
}

/** Satu keluarga fitting: jumlah SKU dan jenis menurut kategori resmi katalog. */
async function fittingTypes(
  catalog: ScopeCatalog,
  family: string,
  locale: Locale,
): Promise<FittingOutcome> {
  const en = locale === 'en';
  const total = (await catalog.familyCounts()).find((c) => c.family === family)?.count ?? 0;
  const categories = await catalog.categoryCounts(family);
  const lines = categories
    .slice(0, 8)
    .map((c) => `- **${fittingTypeLabel(c.category)}** — ${number(c.count, locale)} SKU`);
  const rest = categories.length - 8;
  const text = [
    en
      ? `${family} in the active Pralon catalogue has ${number(total, locale)} active SKUs in ${categories.length} catalogue categories — many because each fitting type comes in many sizes and variants. Largest categories:`
      : `${family} di katalog Pralon yang aktif ada ${number(total, locale)} SKU aktif dalam ${categories.length} kategori katalog — banyak karena tiap jenis fitting dibuat dalam banyak ukuran dan varian. Kategori terbesar:`,
    '',
    ...lines,
    ...(rest > 0 ? [en ? `- and ${rest} other categories` : `- dan ${rest} kategori lainnya`] : []),
    '',
    productAnswerCopy(locale).familyNext,
  ].join('\n');
  return { text, products: [], families: [family] };
}

/** "FITTING PVC" → "fitting PVC" untuk kalimat. */
function fittingTitle(family: string, en: boolean): string {
  const rest = family.replace(FITTING, '').trim();
  return en ? `${rest} fittings` : `fitting ${rest}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
