/**
 * Jawaban pengetahuan dari DATA: fakta bersumber untuk topik yang dikenali (konsep di
 * `pipe-knowledge.ts` + `data/knowledge/pipe-facts.json`) ditambah data katalog yang dihitung saat
 * itu — jumlah produk dan rentang ukuran per keluarga, panjang per batang, kelas tekanan dari nama
 * produk, jumlah batang dari panjang jalur di pesan. Tidak ada jawaban per pertanyaan; yang
 * berubah mengikuti pesan adalah topik, keluarga, dan angkanya.
 */
import type { Locale } from '@snouty/shared-types';
import { designationsOf } from '../../product-catalog/domain/product-identity.js';
import { productSizeOf, productTypesOf } from '../../product-catalog/domain/product-types.js';
import type { FamilyCount } from '../../product-catalog/domain/catalog.repository.js';
import {
  knowledgeFacts,
  type CatalogHook,
  type KnowledgeFact,
} from '../infrastructure/knowledge-facts.js';
import { compareClasses, conceptsFor, type ClassTableRow } from './pipe-knowledge.js';

export interface KnowledgeCatalog {
  familyCounts(): Promise<readonly FamilyCount[]>;
  productNamesInFamily(family: string): Promise<readonly string[]>;
}

export interface KnowledgeAnswer {
  /** Jawaban siap tampil (mode hemat) — sekaligus DATA untuk model (mode kualitas). */
  readonly text: string;
  readonly topics: readonly string[];
  /**
   * Data resmi yang belum ada untuk jawaban ini (`gap` fakta, atau tekanan kerja PVC yang ditanya
   * dengan angka). Pemanggil menawarkan tim teknis dan mencatatnya — bukan angka perkiraan.
   */
  readonly gaps: readonly { readonly topic: string; readonly gap: string }[];
}

const num = (n: number, locale: Locale) =>
  n.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });

/** Keluarga yang masih ditulis sebagai kolom tabel; lebih dari ini, keluarga menjadi baris. */
const MAX_FAMILY_COLUMNS = 4;

/**
 * Panjang batang yang dipakai menghitung jumlah batang harus panjang yang LAZIM di keluarga itu:
 * produk potongan 1 m dan 2 m memberi "27 batang" untuk jalur 27 m (uji sales 2026-10-20).
 * Lazim = dipakai sedikitnya sepersepuluh produk keluarga itu.
 */
const COMMON_LENGTH_SHARE = 0.1;

/** Panjang yang masih ditulis satu per satu; lebih dari ini ditulis rentang. */
const MAX_LISTED_LENGTHS = 8;

const LENGTH = /x\s*(\d+(?:[.,]\d+)?)\s*Meter/i;
/** Panjang jalur di pesan ("27 meter", "60 m") — parser nilai, bukan pola pertanyaan. */
const ROUTE = /(\d+(?:[.,]\d+)?)\s*(?:m|meter|metres?|meters?)\b/gi;

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
  /** Bahan yang disebut pesan (keluarga kanonis kosakata) — subjek yang menentukan fakta. */
  families: readonly string[] = [],
  /**
   * Bahan subjek percakapan saat pesan tidak menyebut bahan ("panjang per batangnya?" setelah HDPE):
   * hanya mempersempit DATA KATALOG. Kalimat pembuka dan pilihan fakta tetap dari pesan — subjek
   * "HDPE vs PVC" tidak boleh membuka "air panas pakai apa?" dengan "Tidak — PVC …".
   */
  subjectFamilies: readonly string[] = [],
): Promise<KnowledgeAnswer | null> {
  const en = locale === 'en';
  const named = families.map((f) => f.toLowerCase());
  const scope = named.length > 0 ? named : subjectFamilies.map((f) => f.toLowerCase());
  // Fakta yang subjeknya bahan lain tidak dipakai bila pesan menyebut bahannya (tes FAQ
  // 2026-10-12: "kegunaan HDPE" dijawab kegunaan uPVC).
  const facts = knowledgeFacts().filter(
    (f) => named.length === 0 || !f.subject || f.subject.some((s) => named.includes(s)),
  );
  const parts: string[] = [];
  const used: string[] = [];
  const gaps: { topic: string; gap: string }[] = [];
  const leads: string[] = [];
  // Angka tekanan di pesan ("8-12 bar"): kelas tekanan dipilih dari angkanya, bukan paragraf umum.
  const pressure = topics.includes('tekanan kerja') ? pressureRange(message) : null;
  if (pressure !== null) {
    const fit = await pressureFit(pressure, named, catalog, locale);
    leads.push(fit.text);
    used.push('tekanan kerja');
    gaps.push(...fit.gaps);
  }
  // Topik dengan fakta bersumber dulu (urutan terdekat tetap terjaga di dalamnya), lalu konsep
  // saja; paling banyak dua topik — topik ketiga hampir selalu tempelan.
  const withFacts: ReadonlySet<string> = new Set(facts.map((f) => f.topic));
  const ordered = [
    ...topics.filter((t) => withFacts.has(t)),
    ...topics.filter((t) => !withFacts.has(t)),
  ].slice(0, 2);
  for (const topic of ordered) {
    if (pressure !== null && topic === 'tekanan kerja') continue;
    const concepts = conceptsFor([topic]).filter((c) => c.topic === topic);
    const own = facts.filter((f) => f.topic === topic);
    if (concepts.length === 0 && own.length === 0) continue;
    used.push(topic);
    // Jawaban langsung lebih dulu bila pesan menyebut bahan yang punya kalimat pembuka.
    // Fakta yang kalimat pembukanya sudah lengkap tidak membawa paragraf utamanya maupun `gap`-nya
    // (P30-05): paragraf itu membicarakan bahan lain, dan pertanyaannya sudah terjawab.
    const answeredByLead = new Set<KnowledgeFact>();
    for (const f of own) {
      const lead = f.leads?.find((l) => l.families.some((x) => named.includes(x)));
      if (lead) {
        leads.push(en ? lead.textEn : lead.text);
        if (f.leadAnswersFully) answeredByLead.add(f);
      }
      if (f.gap && !answeredByLead.has(f)) gaps.push({ topic, gap: f.gap });
    }
    // Dua kelas PVC disebut ("AW sama D") → satu tabel perbandingan kelas menggantikan paragraf
    // konsepnya, dan ukuran/panjang katalognya menjadi baris tabel itu, bukan daftar kedua di bawahnya
    // (pemilik 2026-10-20: "bisa disusun lebih rapi").
    const classTable =
      topic === 'kelas pvc'
        ? compareClasses(named, locale, await classCatalogRows(own, scope, catalog, locale))
        : null;
    if (classTable !== null) parts.push(classTable);
    else for (const c of concepts) parts.push(en ? c.textEn : c.text);
    for (const f of own) {
      // Data katalognya tetap ikut — kelas tekanan HDPE dari katalog memang menjawab pertanyaan
      // tentang HDPE; yang tidak ikut hanya paragraf tentang bahan lain.
      const sentence = answeredByLead.has(f) ? '' : en ? f.textEn : f.text;
      if (sentence) parts.push(sentence);
      const hook = f.catalog && classTable === null ? forNamed(f.catalog, scope) : null;
      if (hook) {
        const lines = await catalogLines(hook, message, catalog, locale).catch(() => []);
        if (lines.length > 0) parts.push(lines.join('\n'));
      }
    }
  }
  if (parts.length === 0 && leads.length === 0) return null;
  return { text: [...leads, ...parts].join('\n\n'), topics: used, gaps };
}

/** Rentang tekanan di pesan ("8-12 bar", "10 bar") — parser nilai bersatuan, bukan pola pertanyaan. */
export function pressureRange(message: string): { min: number; max: number } | null {
  const m = PRESSURE_VALUE.exec(message);
  if (!m) return null;
  const a = decimal(m[1]!);
  const b = m[2] !== undefined ? decimal(m[2]) : a;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/**
 * Kelas tekanan untuk angka yang disebut: kelas harus di atas tekanan tertinggi dan menyisakan ruang
 * untuk lonjakan. Kelas HDPE diambil dari nama produk katalog aktif (PN-x), masing-masing dengan
 * selisihnya — tanpa faktor lonjakan karangan. Kelas PVC belum punya angka resmi → tim teknis.
 */
async function pressureFit(
  range: { min: number; max: number },
  named: readonly string[],
  catalog: KnowledgeCatalog,
  locale: Locale,
): Promise<{ text: string; gaps: { topic: string; gap: string }[] }> {
  const en = locale === 'en';
  const span =
    range.min === range.max
      ? num(range.max, locale)
      : `${num(range.min, locale)}–${num(range.max, locale)}`;
  const lines = [
    en
      ? `For ${span} bar, choose a pipe class rated above the highest pressure (${num(range.max, locale)} bar) with room left for pressure surges (water hammer) when a valve closes or a pump stops; how large the surge is depends on the run length and the water velocity.`
      : `Untuk tekanan ${span} bar, pilih kelas pipa yang tekanan kerjanya di atas tekanan tertinggi (${num(range.max, locale)} bar) dan masih menyisakan ruang untuk lonjakan tekanan (water hammer) saat katup ditutup atau pompa berhenti; besar lonjakannya bergantung pada panjang jalur dan kecepatan air.`,
  ];
  const gaps: { topic: string; gap: string }[] = [];
  const anyPvc = named.some((f) => f.startsWith('pvc'));
  const wantsHdpe = named.length === 0 || named.includes('hdpe');
  if (wantsHdpe) {
    const names = await catalog.productNamesInFamily('HDPE').catch(() => [] as string[]);
    // Label kelas ditulis seperti di katalog ("PN-12.5"); selisihnya angka biasa berlocale.
    const above = designationsOf(names)
      .map((label) => ({ label, m: /^PN-(\d+(?:\.\d+)?)$/.exec(label) }))
      .filter((d): d is { label: string; m: RegExpExecArray } => d.m !== null)
      .map((d) => ({ label: d.label, pn: Number(d.m[1]) }))
      .filter((d) => d.pn > range.max);
    if (above.length > 0) {
      const classes = above
        .map((d) =>
          en
            ? `${d.label} (${num(d.pn - range.max, locale)} bar above)`
            : `${d.label} (selisih ${num(d.pn - range.max, locale)} bar)`,
        )
        .join(', ');
      lines.push(
        en
          ? `- **HDPE** classes in the Pralon catalogue above ${num(range.max, locale)} bar: ${classes}.`
          : `- **HDPE** di katalog Pralon yang kelasnya di atas ${num(range.max, locale)} bar: ${classes}.`,
      );
      // Kelas yang selisihnya lebih kecil dari ayunan tekanan yang disebut pengguna sendiri
      // ruangnya tipis untuk lonjakan — kalimat pembuka di atas seolah sudah menyaringnya,
      // padahal daftar ini memuat semuanya (pemilik 2026-10-27). Pembandingnya angka pengguna,
      // bukan faktor lonjakan karangan: Pralon belum punya angka itu, dan ia tercatat sebagai
      // kekurangan pengetahuan.
      const swing = range.max - range.min;
      const tight = above.filter((d) => d.pn - range.max < swing);
      if (tight.length > 0) {
        const list = joinLabels(
          tight.map((d) => d.label),
          locale,
        );
        lines.push(
          en
            ? `- The margin on ${list} is smaller than the ${num(swing, locale)} bar swing you described, so it leaves little room for a surge; whether it is enough is for the Pralon technical team to confirm.`
            : `- Selisih ${list} lebih kecil dari ayunan tekanan ${num(swing, locale)} bar yang Anda sebutkan, jadi ruangnya untuk lonjakan tipis; cukup atau tidak, tim teknis Pralon yang memastikan.`,
        );
        gaps.push({
          topic: 'tekanan kerja',
          gap: 'ruang lonjakan minimum di atas tekanan kerja',
        });
      }
    } else if (names.length > 0) {
      lines.push(
        en
          ? `- **HDPE**: no class in the active Pralon catalogue is rated above ${num(range.max, locale)} bar.`
          : `- **HDPE**: belum ada kelas di katalog Pralon aktif yang di atas ${num(range.max, locale)} bar.`,
      );
      gaps.push({ topic: 'tekanan kerja', gap: `kelas HDPE di atas ${range.max} bar` });
    }
  }
  if (anyPvc || named.length === 0) {
    lines.push(
      en
        ? `- **uPVC**: whether a PVC class suits ${span} bar follows the official working pressure in the Pralon product specification — the Pralon technical team can confirm it.`
        : `- **uPVC**: kecocokan kelas PVC untuk ${span} bar mengikuti angka tekanan kerja resmi di spesifikasi produk Pralon — tim teknis Pralon bisa memastikannya.`,
    );
    gaps.push({ topic: 'tekanan kerja', gap: 'tekanan kerja resmi tiap kelas PVC' });
  }
  return { text: lines.join('\n'), gaps };
}

async function catalogLines(
  hook: CatalogHook,
  message: string,
  catalog: KnowledgeCatalog,
  locale: Locale,
): Promise<string[]> {
  const en = locale === 'en';
  const header = en ? 'In the active Pralon catalogue:' : 'Di katalog Pralon yang aktif:';
  if (!hook.rods) {
    const entries = await catalogEntries(hook, catalog, locale);
    if (entries.length === 0) return [];
    return entries.length >= 2
      ? // Baris kosong: tabel Markdown tidak boleh menempel pada kalimat sebelumnya.
        [header, '', catalogTable(entries, locale)]
      : [header, catalogBullet(entries[0]!, locale)];
  }
  // Panjang jalur = nilai meter TERBESAR di pesan; nilai lain yang lebih kecil adalah panjang batang
  // yang diminta ("pipa 4 meter untuk jalur 30 meter" → jalur 30 m, batang 4 m). Dulu nilai pertama
  // dipakai sebagai jalur dan jawabannya "untuk 4 m: 1 batang" (audit 2026-10-19).
  const metres = [...message.matchAll(ROUTE)].map((m) => decimal(m[1]!));
  if (metres.length === 0) return [];
  const routeM = Math.max(...metres);
  const askedRods = metres.filter((m) => m !== routeM);
  const lines = [header];
  for (const { family, names } of await familyNames(hook, catalog)) {
    const usable = commonLengths(names).filter((l) => l > 0 && l < 50);
    const asked = usable.filter((l) => askedRods.includes(l));
    const options = (asked.length > 0 ? asked : usable).map((l) =>
      en
        ? `${num(l, locale)} m pipe → ${Math.ceil(routeM / l)} pipes`
        : `batang ${num(l, locale)} m → ${Math.ceil(routeM / l)} batang`,
    );
    if (options.length === 0) continue;
    lines.push(
      en
        ? `- **${family}** for ${num(routeM, locale)} m: ${options.join('; ')}`
        : `- **${family}** untuk ${num(routeM, locale)} m: ${options.join('; ')}`,
    );
  }
  return lines.length > 1 ? lines : [];
}

/** Nama produk per keluarga fakta yang ada di katalog aktif, setelah saringan nama fakta. */
async function familyNames(
  hook: CatalogHook,
  catalog: KnowledgeCatalog,
): Promise<{ family: string; names: readonly string[] }[]> {
  const counts = await catalog.familyCounts();
  const out: { family: string; names: readonly string[] }[] = [];
  for (const family of hook.families ?? []) {
    if (!counts.some((c) => c.family === family)) continue;
    const all = await catalog.productNamesInFamily(family);
    const only = hook.nameIncludes?.[family];
    const names = only ? all.filter((n) => n.toLowerCase().includes(only.toLowerCase())) : all;
    if (names.length > 0) out.push({ family, names });
  }
  return out;
}

/** Panjang yang tertulis di sedikitnya `COMMON_LENGTH_SHARE` nama produk, urut naik. */
function commonLengths(names: readonly string[]): number[] {
  const counts = new Map<number, number>();
  for (const n of names) {
    const raw = LENGTH.exec(n)?.[1];
    if (raw !== undefined) counts.set(decimal(raw), (counts.get(decimal(raw)) ?? 0) + 1);
  }
  const common = [...counts.entries()]
    .filter(([, c]) => c >= names.length * COMMON_LENGTH_SHARE)
    .map(([l]) => l);
  return (common.length > 0 ? common : [...counts.keys()]).sort((a, b) => a - b);
}

function lengthsOf(names: readonly string[]): number[] {
  return [
    ...new Set(
      names
        .map((n) => LENGTH.exec(n)?.[1])
        .filter((l): l is string => l !== undefined)
        .map(decimal),
    ),
  ].sort((a, b) => a - b);
}

/** Ukuran, panjang, kelas, dan jenis per keluarga — dihitung dari nama produk katalog aktif. */
async function catalogEntries(
  hook: CatalogHook,
  catalog: KnowledgeCatalog,
  locale: Locale,
): Promise<CatalogEntry[]> {
  const entries: CatalogEntry[] = [];
  for (const { family, names } of await familyNames(hook, catalog)) {
    const sizes = names
      .map((n) => productSizeOf(n))
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.mm - b.mm);
    const aspects: Partial<Record<CatalogAspect, string>> = {};
    if (sizes.length > 0) {
      const first = sizes[0]!.label;
      const last = sizes[sizes.length - 1]!.label;
      aspects.sizes = first === last ? first : `${first}–${last}`;
    }
    const lengths = lengthsOf(names);
    if (hook.lengths && lengths.length > 0) {
      // Lebih dari beberapa panjang (HDPE: batang dan gulungan, 100+ angka) dibaca sebagai rentang;
      // daftar lengkapnya bukan jawaban (audit campuran 2026-10-20).
      aspects.lengths =
        lengths.length > MAX_LISTED_LENGTHS
          ? `${num(lengths[0]!, locale)}–${num(lengths[lengths.length - 1]!, locale)} m`
          : lengths.map((l) => `${num(l, locale)} m`).join(', ');
    }
    if (hook.pressure) {
      // Hanya kelas yang tertulis di nama produk keluarga ini, satu penulisan per kelas.
      const classes = designationsOf(names);
      if (classes.length > 0) aspects.classes = classes.join(', ');
    }
    if (hook.types) {
      const types = productTypesOf(names)
        .slice(0, 6)
        .map((t) => t.type);
      if (types.length > 0) aspects.types = types.join(', ');
    }
    entries.push({ family, label: hook.labels?.[family] ?? family, count: names.length, aspects });
  }
  return entries;
}

type CatalogAspect = 'sizes' | 'lengths' | 'classes' | 'types';

interface CatalogEntry {
  readonly family: string;
  /** Nama yang ditampilkan — keluarga katalog, atau label fakta bila saringannya mempersempitnya. */
  readonly label: string;
  readonly count: number;
  readonly aspects: Partial<Record<CatalogAspect, string>>;
}

const ASPECT_LABELS: Record<Locale, Record<CatalogAspect, string>> = {
  id: { sizes: 'Ukuran', lengths: 'Panjang batang', classes: 'Kelas', types: 'Jenis' },
  en: { sizes: 'Sizes', lengths: 'Pipe lengths', classes: 'Classes', types: 'Types' },
};

/** Satu keluarga: satu baris butir. */
function catalogBullet(e: CatalogEntry, locale: Locale): string {
  const en = locale === 'en';
  const labels = ASPECT_LABELS[locale];
  const details = [en ? `${num(e.count, locale)} products` : `${num(e.count, locale)} produk`];
  for (const [aspect, value] of Object.entries(e.aspects) as [CatalogAspect, string][]) {
    details.push(
      aspect === 'types'
        ? `${labels.types.toLowerCase()}: ${value}`
        : `${shortLabel(aspect, locale)} ${value}`,
    );
  }
  return `- **${e.label}** — ${details.join(' · ')}`;
}

function shortLabel(aspect: CatalogAspect, locale: Locale): string {
  if (locale === 'en')
    return { sizes: 'sizes', lengths: 'lengths', classes: 'classes', types: 'types' }[aspect];
  return { sizes: 'ukuran', lengths: 'panjang', classes: 'kelas', types: 'jenis' }[aspect];
}

/**
 * Dua keluarga atau lebih: tabel berdampingan — ukuran dan panjang tiap kelas terbaca sejajar
 * (pemilik 2026-10-20: daftar butir AW/D "bisa disusun lebih rapi"). Jumlah produk tidak ikut:
 * ia hitungan SKU, bukan sesuatu yang dipakai orang untuk memilih pipa.
 */
function catalogTable(entries: readonly CatalogEntry[], locale: Locale): string {
  const labels = ASPECT_LABELS[locale];
  const aspects = (Object.keys(labels) as CatalogAspect[]).filter((a) =>
    entries.some((e) => e.aspects[a] !== undefined),
  );
  const cell = (text: string) => text.replace(/\|/g, '/');
  // Banyak keluarga (panjang batang semua pipa: 9 keluarga) tidak muat sebagai kolom di layar
  // ponsel: keluarga menjadi baris, aspek menjadi kolom.
  if (entries.length > MAX_FAMILY_COLUMNS) {
    return [
      `| | ${aspects.map((a) => labels[a]).join(' | ')} |`,
      `| --- | ${aspects.map(() => '---').join(' | ')} |`,
      ...entries.map(
        (e) => `| **${e.label}** | ${aspects.map((a) => cell(e.aspects[a] ?? '—')).join(' | ')} |`,
      ),
    ].join('\n');
  }
  return [
    `| | ${entries.map((e) => `**${e.label}**`).join(' | ')} |`,
    `| --- | ${entries.map(() => '---').join(' | ')} |`,
    ...aspects.map(
      (a) => `| ${labels[a]} | ${entries.map((e) => cell(e.aspects[a] ?? '—')).join(' | ')} |`,
    ),
  ].join('\n');
}

/** Label kelas dalam satu kalimat: "PN-12.5", "PN-12.5 dan PN-16", "PN-10, PN-12.5, dan PN-16". */
function joinLabels(labels: readonly string[], locale: Locale): string {
  const and = locale === 'en' ? 'and' : 'dan';
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} ${and} ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, ${and} ${labels[labels.length - 1]}`;
}

/** Baris katalog (ukuran, panjang batang) per kelas PVC yang disebut, untuk tabel perbandingan kelas. */
async function classCatalogRows(
  facts: readonly KnowledgeFact[],
  named: readonly string[],
  catalog: KnowledgeCatalog,
  locale: Locale,
): Promise<ClassTableRow[]> {
  const hook = facts
    .map((f) => (f.catalog ? forNamed(f.catalog, named) : null))
    .find((h): h is CatalogHook => h !== null);
  if (!hook) return [];
  const entries = await catalogEntries(hook, catalog, locale).catch(() => [] as CatalogEntry[]);
  const labels = ASPECT_LABELS[locale];
  return (Object.keys(labels) as CatalogAspect[])
    .filter((a) => entries.some((e) => e.aspects[a] !== undefined))
    .map((a) => ({
      label: labels[a],
      byFamily: Object.fromEntries(
        entries.map((e) => [e.family.toLowerCase(), e.aspects[a] ?? '—']),
      ),
    }));
}

/** Nilai tekanan dalam bar di pesan ("10 bar", "8-12 bar") — parser nilai, bukan pola pertanyaan. */
export function mentionsPressure(message: string): boolean {
  return PRESSURE_VALUE.test(message);
}
const PRESSURE_VALUE =
  /(\d+(?:[.,]\d+)?)\s*(?:(?:-|–|sampai|s\/d|hingga)\s*(\d+(?:[.,]\d+)?)\s*)?bar\b/i;

/**
 * Data katalog sebuah fakta hanya untuk bahan yang ditanyakan: "pipa pvc aw tahan berapa bar?"
 * tidak ditempeli daftar HDPE dan MDPE (simulasi 2026-10-19). Pesan tanpa bahan memakai semuanya;
 * pesan yang bahannya tidak ada di daftar fakta tidak memakai data katalognya.
 */
function forNamed(hook: CatalogHook, named: readonly string[]): CatalogHook | null {
  if (named.length === 0 || !hook.families) return hook;
  const related = hook.families.filter((family) => {
    const f = family.toLowerCase();
    return named.some((n) => f.includes(n) || n.includes(f));
  });
  return related.length > 0 ? { ...hook, families: related } : null;
}
