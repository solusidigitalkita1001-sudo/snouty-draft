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
  /**
   * Data resmi yang belum ada untuk jawaban ini (`gap` fakta, atau tekanan kerja PVC yang ditanya
   * dengan angka). Pemanggil menawarkan tim teknis dan mencatatnya — bukan angka perkiraan.
   */
  readonly gaps: readonly { readonly topic: string; readonly gap: string }[];
}

const num = (n: number, locale: Locale) =>
  n.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });

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
): Promise<KnowledgeAnswer | null> {
  const en = locale === 'en';
  const named = families.map((f) => f.toLowerCase());
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
    for (const f of own) {
      const lead = f.leads?.find((l) => l.families.some((x) => named.includes(x)));
      if (lead) leads.push(en ? lead.textEn : lead.text);
      if (f.gap) gaps.push({ topic, gap: f.gap });
    }
    for (const c of concepts) parts.push(en ? c.textEn : c.text);
    for (const f of own) {
      parts.push(en ? f.textEn : f.text);
      if (f.catalog) {
        const lines = await catalogLines(f.catalog, message, catalog, locale).catch(() => []);
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
        ? `- **uPVC**: the official working pressure of each PVC class is not in my data yet, so whether it suits ${span} bar needs to be confirmed by the Pralon technical team.`
        : `- **uPVC**: angka tekanan kerja resmi tiap kelas PVC belum ada di data saya, jadi kecocokannya untuk ${span} bar perlu dipastikan tim teknis Pralon.`,
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
  const counts = await catalog.familyCounts();
  const present = (hook.families ?? []).filter((f) => counts.some((c) => c.family === f));
  if (present.length === 0) return [];
  const lines: string[] = [];
  // Panjang jalur = nilai meter TERBESAR di pesan; nilai lain yang lebih kecil adalah panjang batang
  // yang diminta ("pipa 4 meter untuk jalur 30 meter" → jalur 30 m, batang 4 m). Dulu nilai pertama
  // dipakai sebagai jalur dan jawabannya "untuk 4 m: 1 batang" (audit 2026-10-19).
  const metres = hook.rods ? [...message.matchAll(ROUTE)].map((m) => decimal(m[1]!)) : [];
  const routeM = metres.length > 0 ? Math.max(...metres) : null;
  const askedRods = metres.filter((m) => m !== routeM);
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
      const usable = lengths.filter((l) => l > 0 && l < 50);
      const asked = usable.filter((l) => askedRods.includes(l));
      const options = (asked.length > 0 ? asked : usable).map((l) =>
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
      // Hanya kelas yang tertulis di nama produk keluarga ini, satu penulisan per kelas.
      const classes = designationsOf(names);
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
const PRESSURE_VALUE =
  /(\d+(?:[.,]\d+)?)\s*(?:(?:-|–|sampai|s\/d|hingga)\s*(\d+(?:[.,]\d+)?)\s*)?bar\b/i;
