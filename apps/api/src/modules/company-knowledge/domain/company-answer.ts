/**
 * Penyusun jawaban perusahaan — fungsi murni. Kedalaman mengatur BERAPA BANYAK bagian yang
 * diceritakan, bukan apa yang boleh dikarang: teks hanya berisi bagian yang punya sumber.
 *
 * Bentuknya obrolan, bukan dokumen (aturan teks proyek; audit keterbacaan 2026-10-08): prosa per
 * paragraf tanpa judul tebal, tanpa kalimat tentang "verifikasi" atau "materi internal", dan
 * lanjutan ("boleh", "lengkap dong") hanya menambah bagian yang BELUM diceritakan — lalu satu
 * tawaran lanjutan yang wajar, seperti teknisi yang menjelaskan sambil menawarkan detail berikutnya.
 */
import type { AnswerDepth, Locale } from '@snouty/shared-types';
import {
  COMPANY_BRAND,
  SECTION_ORDER,
  type CompanySection,
  type CompanySectionId,
} from './company-profile.js';

/** Fakta yang terkumpul untuk satu jawaban: bagian statis + ragam produk dari katalog aktif. */
export interface CompanyFacts {
  readonly sections: readonly CompanySection[];
  /** Keluarga produk → nama anggotanya; kosong bila katalog Pralon belum aktif. */
  readonly productFamilies: ReadonlyMap<string, readonly string[]>;
}

export interface CompanyAnswerInput {
  readonly facts: CompanyFacts;
  readonly depth: AnswerDepth;
  /** Topik dari subjek percakapan: `company_profile`, `history`, `products`, `contact`, … */
  readonly topic: string;
  readonly locale: Locale;
  /** Pertanyaan pertama yang ambigu ("pralon itu apa?"): sebutkan juga pembedanya dengan produk. */
  readonly ambiguous?: boolean;
  /**
   * Berapa bagian topik ini yang SUDAH diceritakan di giliran sebelumnya — lanjutan hanya
   * menambah sisanya. 0 untuk pertanyaan baru.
   */
  readonly alreadyShown?: number;
}

export interface CompanyAnswer {
  readonly text: string;
  /** Ada bagian yang diminta tetapi belum ada sumbernya → tawarkan tim Pralon. */
  readonly needsTeam: boolean;
}

/** Bagian yang relevan untuk sebuah topik; ikhtisar/profil = urutan umum (tanpa daftar katalog). */
const TOPIC_SECTIONS: Readonly<Record<string, readonly CompanySectionId[]>> = {
  history: ['milestones', 'overview'],
  products: ['product_categories', 'business_focus'],
  manufacturing: ['manufacturing', 'quality', 'certifications'],
  certifications: ['certifications', 'quality'],
  vision_mission: ['vision', 'mission'],
  contact: ['contact', 'website', 'distribution'],
};

/** Ikhtisar perusahaan tidak memuat hitungan keluarga katalog — itu milik pertanyaan produk. */
const PROFILE_SECTIONS = SECTION_ORDER.filter((id) => id !== 'product_categories');

/** Berapa bagian yang diceritakan per kedalaman; `comprehensive` = semuanya. */
const DEPTH_LIMIT: Readonly<Record<AnswerDepth, number>> = {
  brief: 1,
  standard: 2,
  detailed: 4,
  comprehensive: Number.POSITIVE_INFINITY,
};

export function sectionsShownAt(depth: AnswerDepth): number {
  return DEPTH_LIMIT[depth];
}

/** Frasa untuk tawaran lanjutan ("Mau saya lanjutkan dengan …?"), per bagian. */
const NEXT_PHRASE: Readonly<Record<CompanySectionId, { id: string; en: string }>> = {
  overview: { id: 'gambaran umumnya', en: 'the overview' },
  business_focus: { id: 'ragam produknya', en: 'the product range' },
  product_categories: { id: 'produk di katalognya', en: 'the catalogue products' },
  markets: { id: 'pemakaiannya', en: 'where the pipes are used' },
  manufacturing: { id: 'proses produksinya', en: 'how the pipes are made' },
  quality: { id: 'pengendalian mutunya', en: 'quality control' },
  certifications: { id: 'sertifikasinya', en: 'certifications' },
  milestones: { id: 'sejarahnya', en: 'its history' },
  distribution: { id: 'distribusinya', en: 'distribution' },
  vision: { id: 'visinya', en: 'its vision' },
  mission: { id: 'misinya', en: 'its mission' },
  sustainability: { id: 'keberlanjutannya', en: 'sustainability' },
  affiliations: { id: 'afiliasinya', en: 'affiliations' },
  contact: { id: 'kontaknya', en: 'contact details' },
  website: { id: 'situs resminya', en: 'the official website' },
};

/** Label untuk "yang belum saya pegang" — huruf kecil, dalam kalimat. */
const MISSING_PHRASE: Readonly<Record<CompanySectionId, { id: string; en: string }>> = {
  ...NEXT_PHRASE,
  distribution: { id: 'jaringan distribusi', en: 'the distribution network' },
  vision: { id: 'visi', en: 'vision' },
  mission: { id: 'misi', en: 'mission' },
  sustainability: { id: 'program keberlanjutan', en: 'sustainability programmes' },
  affiliations: { id: 'afiliasi', en: 'affiliations' },
};

function sectionText(id: CompanySectionId, facts: CompanyFacts, locale: Locale): string | null {
  if (id === 'product_categories') {
    if (facts.productFamilies.size === 0) return null;
    // Satu kalimat, bukan daftar hitungan: profil meringkas; daftar lengkapnya milik pertanyaan produk.
    const families = [...facts.productFamilies.keys()];
    const named = families.slice(0, 5).join(', ');
    return locale === 'en'
      ? `The active Pralon catalogue has ${families.length} product families, including ${named}.`
      : `Di katalog Pralon yang aktif ada ${families.length} keluarga produk, antara lain ${named}.`;
  }
  return facts.sections.find((s) => s.id === id)?.text[locale] ?? null;
}

function joinPhrases(items: readonly string[], locale: Locale): string {
  const and = locale === 'en' ? 'and' : 'dan';
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} ${and} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${and} ${items.at(-1)}`;
}

export function composeCompanyAnswer(input: CompanyAnswerInput): CompanyAnswer {
  const { facts, depth, locale } = input;
  const en = locale === 'en';
  const wanted = TOPIC_SECTIONS[input.topic] ?? PROFILE_SECTIONS;
  const available = wanted.filter((id) => sectionText(id, facts, locale) !== null);
  const missing = wanted.filter((id) => sectionText(id, facts, locale) === null);

  // Ikhtisar dulu bila ada — tanpa itu "Pralon itu apa?" dimulai dari hal yang bukan intinya.
  const ordered = [
    ...available.filter((id) => id === 'overview'),
    ...available.filter((id) => id !== 'overview'),
  ];
  const limit = Math.max(DEPTH_LIMIT[depth], 1);
  const from = Math.min(input.alreadyShown ?? 0, ordered.length);
  const shown = ordered.slice(
    from,
    Math.max(from, limit === Number.POSITIVE_INFINITY ? ordered.length : limit),
  );
  const remaining = ordered.slice(from + shown.length);

  const parts: string[] = [];
  // "Pabriknya di mana?": lokasinya belum ada di sumber — katakan dulu, lalu yang bisa diceritakan.
  if (input.topic === 'manufacturing' && from === 0) {
    parts.push(
      en
        ? "I don't have the plant locations yet; what I can tell you is how the pipes are made."
        : 'Lokasi pabriknya belum saya pegang; yang bisa saya ceritakan adalah proses produksinya.',
    );
  }
  for (const id of shown) parts.push(sectionText(id, facts, locale)!);

  // Yang tidak ada dikatakan tidak ada — hanya bila pengguna memang meminta lebih atau topiknya itu.
  const asksMore =
    depth === 'detailed' || depth === 'comprehensive' || input.topic !== 'company_overview';
  const missingLabels = missing
    .filter((id) => id !== 'product_categories')
    .map((id) => MISSING_PHRASE[id][locale]);
  const needsTeam = asksMore && remaining.length === 0 && missing.length > 0;
  if (needsTeam && missingLabels.length > 0) {
    parts.push(
      en
        ? `For ${joinPhrases(missingLabels, locale)}, the Pralon team can send the official company profile.`
        : `Untuk ${joinPhrases(missingLabels, locale)}, tim Pralon bisa mengirimkan profil perusahaan resminya.`,
    );
  }
  if (needsTeam && missing.includes('product_categories') && shown.length === 0) {
    parts.push(
      en
        ? 'The product list will appear here once the official Pralon catalogue is installed.'
        : 'Daftar produknya akan bisa saya sebutkan setelah katalog resmi Pralon terpasang.',
    );
  }

  if (input.ambiguous) {
    parts.push(
      en
        ? 'If you meant a specific Pralon product, name the type — for example PVC AW or HDPE.'
        : 'Kalau yang Anda maksud produk Pralon tertentu, sebutkan tipenya — misalnya PVC AW atau HDPE.',
    );
  } else if (remaining.length > 0) {
    const next = joinPhrases(
      remaining.slice(0, 2).map((id) => NEXT_PHRASE[id][locale]),
      locale,
    );
    parts.push(en ? `Shall I go on with ${next}?` : `Mau saya lanjutkan dengan ${next}?`);
  }

  // Lanjutan setelah semuanya diceritakan: katakan begitu, jangan mengulang.
  if (shown.length === 0 && from > 0) {
    parts.unshift(
      en
        ? `That covers what I can tell you about ${COMPANY_BRAND}.`
        : `Itu sudah semua yang bisa saya ceritakan tentang ${COMPANY_BRAND}.`,
    );
  }
  // Tidak ada satu pun bagian bersumber: tetap menjawab, tidak diam.
  if (parts.length === 0) {
    parts.push(
      en
        ? `${COMPANY_BRAND} is a piping manufacturer; the Pralon team can send the official company profile.`
        : `${COMPANY_BRAND} adalah produsen sistem perpipaan; tim Pralon bisa mengirimkan profil perusahaan resminya.`,
    );
  }
  return { text: parts.join('\n\n'), needsTeam };
}
