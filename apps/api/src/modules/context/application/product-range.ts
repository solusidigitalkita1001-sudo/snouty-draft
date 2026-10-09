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
import {
  productSizeOf,
  productTypeOf,
  productTypesOf,
  sizesByType,
  type ProductType,
} from '../../product-catalog/domain/product-types.js';
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

const NL = '\n';
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

/**
 * Jenis yang disebut pesan ("yang telkom", "PE 100 aja"): kata pembeda tiap jenis — kata yang
 * tidak dimiliki SEMUA jenis keluarga itu — harus ada semua di pesan. Pencocokan atas nama jenis
 * dari katalog (data), bukan atas pola kalimat.
 */
export function chosenType(types: readonly string[], message: string): string | null {
  const words = (s: string) =>
    s
      .toLowerCase()
      .replace(/[()]/g, ' ')
      .split(/[\s-]+/)
      .filter(Boolean);
  const said = new Set(words(message));
  const shared = types
    .map((t) => new Set(words(t)))
    .reduce((acc, set) => new Set([...acc].filter((w) => set.has(w))));
  const matches = types.filter((t) => {
    const own = words(t).filter((w) => !shared.has(w));
    return own.length > 0 && own.every((w) => said.has(w));
  });
  // Yang paling spesifik menang: "PE 100 perforated" lebih dari "PE 100".
  return matches.sort((a, b) => words(b).length - words(a).length)[0] ?? null;
}

/**
 * Lanjutan atas jawaban jenis keluarga: "boleh" → rentang ukuran tiap jenis; "yang telkom" →
 * semua ukuran jenis itu. `null` bila pesan tidak memilih jenis dan bukan persetujuan
 * (`acceptsOffer` false) — pemanggil menjawabnya lewat jalur biasa.
 */
export async function familySizes(
  catalog: RangeCatalog,
  mentioned: readonly string[],
  message: string,
  acceptsOffer: boolean,
  /** Jawaban asisten sebelumnya — ringkasan rentang yang sudah diberikan tidak diulang. */
  previousText: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<RangeOutcome | null> {
  const COPY = productAnswerCopy(locale);
  const en = locale === 'en';
  const counts = await countsFrom(catalog);
  if (counts === null) return null;
  const pipes = matchingFamilies(counts, mentioned).filter((f) => !FITTING.test(f.family));
  if (pipes.length === 0) return null;

  const names = (
    await Promise.all(pipes.map((f) => catalog.productNamesInFamily(f.family)))
  ).flat();
  const byType = sizesByType(names);
  const types = productTypesOf(names)
    .map((t) => t.type)
    .filter((t) => byType.has(t));
  const chosen = chosenType(types, message);
  if (chosen === null && !acceptsOffer) return null;

  // "tampilin semua" setelah ringkasan rentang: semua ukuran tiap jenis — dulu ringkasan yang
  // sama diulang persis (laporan pemilik 2026-10-09).
  const summarized = (['id', 'en'] as const).some((l) =>
    previousText.includes(productAnswerCopy(l).typeNext),
  );
  if (chosen === null && summarized) {
    const blocks = types.map((type) => {
      const sizes = byType.get(type)!;
      const count = en ? `${sizes.length} sizes` : `${sizes.length} ukuran`;
      return [`**${type}** (${count})`, sizes.map((s) => s.label).join(', ')].join(NL);
    });
    return {
      text: [
        en
          ? 'All sizes per type in the Pralon catalogue:'
          : 'Semua ukuran per jenis di katalog Pralon:',
        '',
        blocks.join(NL + NL),
        '',
        COPY.sizeNext,
      ].join(NL),
      cards: [],
    };
  }

  if (chosen !== null) {
    const sizes = byType.get(chosen) ?? [];
    return {
      text: [
        en
          ? `${chosen} in the Pralon catalogue comes in ${sizes.length} sizes:`
          : `${chosen} di katalog Pralon tersedia dalam ${sizes.length} ukuran:`,
        '',
        sizes.map((s) => s.label).join(', '),
        '',
        COPY.sizeNext,
      ].join('\n'),
      cards: [],
    };
  }

  const lines = types.slice(0, MAX_TYPES).map((type) => {
    const sizes = byType.get(type)!;
    const span =
      sizes.length <= 4
        ? joinNatural(
            sizes.map((s) => s.label),
            locale,
          )
        : en
          ? `${sizes[0]!.label} to ${sizes.at(-1)!.label} (${sizes.length} sizes)`
          : `${sizes[0]!.label} sampai ${sizes.at(-1)!.label} (${sizes.length} ukuran)`;
    return `- **${type}** — ${span}`;
  });
  return {
    text: [
      en ? 'Sizes per type in the Pralon catalogue:' : 'Ukuran per jenis di katalog Pralon:',
      '',
      ...lines,
      '',
      COPY.typeNext,
    ].join('\n'),
    cards: [],
  };
}

/**
 * Ukuran dalam SATU keluarga katalog, dipilih perencana giliran (P16-29): semua ukuran satu jenis,
 * ukuran terkecil/terbesar ("paling kecil berapa?"), atau rentang per jenis. Semua dari nama produk
 * katalog; contoh produk disebut supaya angkanya bisa diperiksa. `null` bila katalog Pralon belum
 * terpasang atau keluarganya tanpa ukuran terbaca.
 */
export async function familySizeAnswer(
  catalog: RangeCatalog,
  family: string,
  type: string | null,
  extreme: 'smallest' | 'largest' | null,
  locale: Locale = DEFAULT_LOCALE,
): Promise<RangeOutcome | null> {
  const COPY = productAnswerCopy(locale);
  const en = locale === 'en';
  if ((await countsFrom(catalog)) === null) return null;
  const names = await catalog.productNamesInFamily(family);
  const byType = sizesByType(names);
  if (byType.size === 0) return null;
  const types = productTypesOf(names)
    .map((t) => t.type)
    .filter((t) => byType.has(t));
  const chosen = type === null ? null : chosenType(types, type);
  const subject = chosen ?? family;

  if (extreme !== null) {
    const pool = chosen !== null ? (byType.get(chosen) ?? []) : [...byType.values()].flat();
    const sorted = [...pool].sort((a, b) => a.mm - b.mm);
    const size = extreme === 'smallest' ? sorted[0] : sorted.at(-1);
    if (size === undefined) return null;
    const example = names.find(
      (n) =>
        productSizeOf(n)?.label === size.label &&
        (chosen === null || productTypeOf(n).type === chosen),
    );
    const word =
      extreme === 'smallest' ? (en ? 'smallest' : 'terkecil') : en ? 'largest' : 'terbesar';
    return {
      text: [
        en
          ? `The ${word} ${subject} size in the Pralon catalogue is ${size.label}${example ? `, for example ${example}` : ''}.`
          : `Ukuran ${word} ${subject} di katalog Pralon adalah ${size.label}${example ? `, misalnya ${example}` : ''}.`,
        '',
        COPY.sizeNext,
      ].join(NL),
      cards: [],
    };
  }

  if (chosen !== null) {
    const sizes = byType.get(chosen) ?? [];
    return {
      text: [
        en
          ? `${chosen} in the Pralon catalogue comes in ${sizes.length} sizes:`
          : `${chosen} di katalog Pralon tersedia dalam ${sizes.length} ukuran:`,
        '',
        sizes.map((s) => s.label).join(', '),
        '',
        COPY.sizeNext,
      ].join(NL),
      cards: [],
    };
  }

  const lines = types.slice(0, MAX_TYPES).map((t) => {
    const sizes = byType.get(t)!;
    const span =
      sizes.length <= 4
        ? joinNatural(
            sizes.map((s) => s.label),
            locale,
          )
        : en
          ? `${sizes[0]!.label} to ${sizes.at(-1)!.label} (${sizes.length} sizes)`
          : `${sizes[0]!.label} sampai ${sizes.at(-1)!.label} (${sizes.length} ukuran)`;
    return `- **${t}** — ${span}`;
  });
  return {
    text: [
      en
        ? `Sizes per ${family} type in the Pralon catalogue:`
        : `Ukuran per jenis ${family} di katalog Pralon:`,
      '',
      ...lines,
      '',
      COPY.typeNext,
    ].join(NL),
    cards: [],
  };
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
    // Rincian ukuran juga lanjutan atas jenis keluarga: "yang telkom" sesudahnya tetap memilih jenis.
    if (
      lastAssistantText.includes(copy.familyNext) ||
      lastAssistantText.includes(copy.typeNext) ||
      lastAssistantText.includes(copy.sizeNext)
    ) {
      return 'family';
    }
    if (
      lastAssistantText.includes(copy.rangeNext) ||
      lastAssistantText.includes(copy.catalogNotInstalled) ||
      // Pertanyaan pilihan atas ikhtisar (`overviewChoice`): jawaban "pvc" sesudahnya memilih keluarga.
      lastAssistantText.includes(
        l === 'en' ? 'Which one shall I explain:' : 'Mau saya jelaskan yang mana:',
      )
    ) {
      return 'overview';
    }
  }
  return null;
}

/**
 * "boleh" atas ikhtisar ragam produk. Tawarannya dua arah ("jelaskan salah satunya, atau ceritakan
 * bangunannya"), jadi persetujuan saja belum memilih — tanyakan keluarganya dengan nama yang memang
 * ada di katalog (dulu dibalas ajakan umum "Silakan, tanyakan saja", laporan pemilik 2026-10-09).
 */
export async function overviewChoice(
  catalog: RangeCatalog,
  locale: Locale = DEFAULT_LOCALE,
): Promise<RangeOutcome | null> {
  const counts = await countsFrom(catalog);
  if (counts === null) return null;
  const pipes = grouped(counts)
    .filter((g) => !FITTING.test(g.label))
    .map((g) => g.label);
  const options = joinNatural([...pipes, locale === 'en' ? 'fittings' : 'fitting'], locale);
  return {
    text:
      locale === 'en'
        ? `Sure. Which one shall I explain: ${options}? Or tell me about the building — floors, bathrooms, and water source — and I will pick for you.`
        : `Siap. Mau saya jelaskan yang mana: ${options}? Atau ceritakan bangunannya — jumlah lantai, kamar mandi, dan sumber airnya — supaya saya pilihkan.`,
    cards: [],
  };
}
