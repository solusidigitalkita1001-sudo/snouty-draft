/**
 * Penyusun jawaban perusahaan — fungsi murni. Kedalaman mengatur BERAPA BANYAK bagian
 * terverifikasi yang ditampilkan, bukan apa yang boleh dikarang: pada kedalaman apa pun, teks
 * hanya berisi bagian yang punya sumber, lalu satu kalimat jujur tentang yang belum ada.
 */
import type { AnswerDepth, Locale } from '@snouty/shared-types';
import {
  COMPANY_BRAND,
  SECTION_ORDER,
  sectionLabel,
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
}

export interface CompanyAnswer {
  readonly text: string;
  /** Ada bagian yang diminta tetapi belum terverifikasi → tawarkan tim Pralon. */
  readonly needsTeam: boolean;
}

/** Bagian yang relevan untuk sebuah topik; `company_profile`/ikhtisar = semuanya. */
const TOPIC_SECTIONS: Readonly<Record<string, readonly CompanySectionId[]>> = {
  history: ['milestones', 'overview'],
  products: ['product_categories', 'business_focus'],
  manufacturing: ['manufacturing', 'quality', 'certifications'],
  certifications: ['certifications', 'quality'],
  vision_mission: ['vision', 'mission'],
  contact: ['contact', 'website', 'distribution'],
};

/** Berapa bagian yang dibuka per kedalaman; `comprehensive` membuka semuanya. */
const DEPTH_LIMIT: Readonly<Record<AnswerDepth, number>> = {
  brief: 1,
  standard: 3,
  detailed: 6,
  comprehensive: Number.POSITIVE_INFINITY,
};

interface Copy {
  readonly productIntro: string;
  readonly noCatalog: string;
  readonly unverified: (labels: string) => string;
  readonly askTeam: string;
  readonly ambiguousTail: string;
  readonly verifiedIntro: string;
}

const COPY: Readonly<Record<Locale, Copy>> = {
  id: {
    productIntro: 'Keluarga produk di katalog Pralon yang aktif:',
    noCatalog:
      'Ragam produknya belum bisa saya sebutkan — katalog resmi Pralon belum terpasang di sistem ini.',
    unverified: (labels) =>
      `Yang belum bisa saya verifikasi dari sumber resmi: ${labels}. Saya tidak mengarangnya.`,
    askTeam: 'Untuk bagian itu, tim Pralon bisa mengirimkan profil perusahaan resminya.',
    ambiguousTail:
      'Kalau yang Anda maksud produk Pralon tertentu, sebutkan tipenya — misalnya PVC AW atau HDPE.',
    verifiedIntro: 'Informasi yang dapat saya verifikasi saat ini:',
  },
  en: {
    productIntro: 'Product families in the active Pralon catalog:',
    noCatalog:
      'I cannot list the product range yet — the official Pralon catalog is not installed in this system.',
    unverified: (labels) =>
      `What I cannot verify from an official source yet: ${labels}. I will not make it up.`,
    askTeam: 'For those, the Pralon team can send the official company profile.',
    ambiguousTail:
      'If you meant a specific Pralon product, name the type — for example PVC AW or HDPE.',
    verifiedIntro: 'What I can verify right now:',
  },
};

function sectionText(id: CompanySectionId, facts: CompanyFacts, locale: Locale): string | null {
  if (id === 'product_categories') {
    if (facts.productFamilies.size === 0) return null;
    const lines = [...facts.productFamilies.entries()].map(
      ([family, members]) => `- **${family}**: ${members.join(', ')}`,
    );
    return [COPY[locale].productIntro, ...lines].join('\n');
  }
  return facts.sections.find((s) => s.id === id)?.text[locale] ?? null;
}

export function composeCompanyAnswer(input: CompanyAnswerInput): CompanyAnswer {
  const { facts, depth, locale } = input;
  const copy = COPY[locale];
  const wanted = TOPIC_SECTIONS[input.topic] ?? SECTION_ORDER;
  const available = wanted.filter((id) => sectionText(id, facts, locale) !== null);
  const missing = wanted.filter((id) => sectionText(id, facts, locale) === null);

  // Ikhtisar selalu ikut bila ada — tanpa itu jawaban "Pralon itu apa?" mulai dari daftar produk.
  const ordered = [
    ...available.filter((id) => id === 'overview'),
    ...available.filter((id) => id !== 'overview'),
  ].slice(0, DEPTH_LIMIT[depth]);

  const parts: string[] = [];
  if (depth === 'brief' || ordered.length <= 1) {
    const only = ordered[0] ?? null;
    if (only !== null) parts.push(sectionText(only, facts, locale)!);
  } else {
    if (depth === 'comprehensive') parts.push(copy.verifiedIntro);
    for (const id of ordered) {
      parts.push(`**${sectionLabel(id, locale)}**\n${sectionText(id, facts, locale)!}`);
    }
  }

  // Yang tidak ada dikatakan tidak ada — hanya bila pengguna memang meminta lebih dari yang tersedia.
  const asksMore =
    depth === 'detailed' || depth === 'comprehensive' || input.topic !== 'company_overview';
  const needsTeam = asksMore && missing.length > 0;
  if (needsTeam) {
    const labels = missing
      .filter((id) => id !== 'product_categories')
      .map((id) => sectionLabel(id, locale).toLowerCase());
    if (missing.includes('product_categories')) parts.push(copy.noCatalog);
    if (labels.length > 0) parts.push(`${copy.unverified(labels.join(', '))} ${copy.askTeam}`);
  }
  if (input.ambiguous) parts.push(copy.ambiguousTail);

  if (parts.length === 0) {
    // Tidak ada satu pun bagian: tetap jujur tentang merek, bukan diam.
    parts.push(
      locale === 'en'
        ? `${COMPANY_BRAND} is the brand this assistant serves; I cannot verify more about the company yet. ${copy.askTeam}`
        : `${COMPANY_BRAND} adalah merek yang dilayani asisten ini; lebih dari itu belum bisa saya verifikasi. ${copy.askTeam}`,
    );
  }
  return { text: parts.join('\n\n'), needsTeam };
}
