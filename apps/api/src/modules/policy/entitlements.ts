/**
 * Tabel entitlement — SATU sumber untuk API guard DAN daftar manfaat onboarding
 * langkah 5. docs/POLICY.md §6 · SPEC §4.6 · SPEC §33e.
 *
 * Modul `policy` wajib leaf (docs/ARCHITECTURE.md §7): berkas ini data murni dan
 * fungsi murni; satu-satunya impor adalah tipe/konstanta locale dari `@snouty/shared-types`. Pagar lint menolak I/O masuk ke sini.
 *
 * SPEC §4.6 menandai `REPORT_PDF` untuk `registered` dengan `?` — pertanyaan
 * terbuka (OQ-15 wilayahnya). Nilai di sini mengikuti usulan default
 * `docs/POLICY.md`: hanya `advanced`. Mengubah keputusan itu nanti = mengubah SATU
 * baris di tabel ini, dan guard serta onboarding ikut serentak — itulah alasan
 * keduanya dilarang menulis daftarnya sendiri.
 */

import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';

export type Tier = 'guest' | 'registered' | 'advanced';

export type Capability =
  | 'PRODUCT_QA'
  | 'RECOMMENDATION'
  | 'CLARIFICATION'
  | 'TECHNICAL_HANDOFF'
  | 'CONVERSATION_HISTORY'
  | 'SAVE_SOLUTION'
  | 'CASE_ANALYSIS'
  | 'MATERIAL_BOM'
  | 'SCHEMATIC'
  | 'REPORT_PDF';

export const ENTITLEMENTS: Readonly<Record<Capability, readonly Tier[]>> = {
  PRODUCT_QA: ['guest', 'registered', 'advanced'],
  RECOMMENDATION: ['guest', 'registered', 'advanced'],
  CLARIFICATION: ['guest', 'registered', 'advanced'],
  TECHNICAL_HANDOFF: ['guest', 'registered', 'advanced'],
  CONVERSATION_HISTORY: ['registered', 'advanced'],
  SAVE_SOLUTION: ['registered', 'advanced'],
  CASE_ANALYSIS: ['advanced'],
  MATERIAL_BOM: ['advanced'],
  SCHEMATIC: ['advanced'],
  REPORT_PDF: ['advanced'],
};

export function isEntitled(tier: Tier, capability: Capability): boolean {
  return ENTITLEMENTS[capability].includes(tier);
}

/** Tag pada kartu manfaat onboarding (SPEC §33e). */
export type OnboardingTag = 'TAMU JUGA' | 'AKUN' | 'LANJUTAN';

/**
 * Tag DITURUNKAN dari tabel, bukan ditulis per kapabilitas: tamu ada di daftar →
 * `TAMU JUGA`; terendahnya `registered` → `AKUN`; hanya `advanced` → `LANJUTAN`.
 * Kapabilitas baru otomatis mendapat tag yang benar — atau galat kompilasi bila
 * lupa masuk tabel, dan keduanya lebih baik daripada tag yang basi.
 */
export function onboardingTag(capability: Capability): OnboardingTag {
  const tiers = ENTITLEMENTS[capability];
  if (tiers.includes('guest')) return 'TAMU JUGA';
  if (tiers.includes('registered')) return 'AKUN';
  return 'LANJUTAN';
}

/**
 * Label tampilan Bahasa Indonesia — **copy dari desain layar 14** untuk enam yang
 * tampil di onboarding; sisanya mengikuti nama di SPEC §4.6. HANYA kosmetik:
 * keputusan boleh/tidaknya selalu dari `ENTITLEMENTS`.
 */
export const CAPABILITY_LABEL: Readonly<Record<Capability, string>> = {
  PRODUCT_QA: 'Tanya jawab produk Pralon',
  RECOMMENDATION: 'Rekomendasi produk Pralon',
  CLARIFICATION: 'Pertanyaan klarifikasi',
  TECHNICAL_HANDOFF: 'Kirim ke tim teknis Pralon',
  CONVERSATION_HISTORY: 'Riwayat percakapan',
  SAVE_SOLUTION: 'Simpan hasil konsultasi',
  CASE_ANALYSIS: 'Analisis studi kasus',
  MATERIAL_BOM: 'Estimasi kebutuhan material',
  SCHEMATIC: 'Visualisasi skema perpipaan',
  REPORT_PDF: 'Laporan PDF',
};

export const CAPABILITY_LABEL_EN: Readonly<Record<Capability, string>> = {
  PRODUCT_QA: 'Pralon product Q&A',
  RECOMMENDATION: 'Pralon product recommendations',
  CLARIFICATION: 'Clarification questions',
  TECHNICAL_HANDOFF: 'Send to the Pralon technical team',
  CONVERSATION_HISTORY: 'Conversation history',
  SAVE_SOLUTION: 'Save consultation results',
  CASE_ANALYSIS: 'Case study analysis',
  MATERIAL_BOM: 'Material quantity estimate',
  SCHEMATIC: 'Piping schematic visualization',
  REPORT_PDF: 'PDF report',
};

export function capabilityLabel(capability: Capability, locale: Locale = DEFAULT_LOCALE): string {
  return (locale === 'en' ? CAPABILITY_LABEL_EN : CAPABILITY_LABEL)[capability];
}

const ONBOARDING_TAG_LABEL_EN: Readonly<Record<OnboardingTag, string>> = {
  'TAMU JUGA': 'GUESTS TOO',
  AKUN: 'ACCOUNT',
  LANJUTAN: 'ADVANCED',
};

/** Label tampilan tag; nilai `OnboardingTag` tetap protokol berbahasa Indonesia. */
export function onboardingTagLabel(tag: OnboardingTag, locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? ONBOARDING_TAG_LABEL_EN[tag] : tag;
}

export interface OnboardingBenefit {
  readonly capability: Capability;
  readonly label: string;
  readonly tag: OnboardingTag;
}

/**
 * Enam kapabilitas yang TAMPIL di onboarding langkah 5, **dalam urutan desain**
 * (layar 14). Daftarnya kurasi desain — ia memuat satu kapabilitas tamu
 * (`RECOMMENDATION`, bertag TAMU JUGA, sebagai sinyal bahwa tamu pun dapat
 * banyak) dan tidak memuat `REPORT_PDF` (dicatat OQ-41). Yang DITURUNKAN dari
 * tabel adalah **tag-nya** — dan turunan itu cocok persis dengan tag yang
 * digambar desainer, yang justru membuktikan tabel dan desain sedang sepakat.
 */
const ONBOARDING_DISPLAY: readonly Capability[] = [
  'CONVERSATION_HISTORY',
  'SAVE_SOLUTION',
  'CASE_ANALYSIS',
  'MATERIAL_BOM',
  'RECOMMENDATION',
  'SCHEMATIC',
];

export function onboardingBenefits(locale: Locale = DEFAULT_LOCALE): readonly OnboardingBenefit[] {
  return ONBOARDING_DISPLAY.map((capability) => ({
    capability,
    label: capabilityLabel(capability, locale),
    tag: onboardingTag(capability),
  }));
}
