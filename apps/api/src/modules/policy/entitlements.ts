/**
 * Tabel entitlement — SATU sumber untuk API guard DAN daftar manfaat onboarding
 * langkah 5. docs/POLICY.md §6 · SPEC §4.6 · SPEC §33e.
 *
 * Modul `policy` wajib leaf (docs/ARCHITECTURE.md §7): berkas ini data murni dan
 * fungsi murni, tanpa satu pun impor. Pagar lint menolak I/O masuk ke sini.
 *
 * SPEC §4.6 menandai `REPORT_PDF` untuk `registered` dengan `?` — pertanyaan
 * terbuka (OQ-15 wilayahnya). Nilai di sini mengikuti usulan default
 * `docs/POLICY.md`: hanya `advanced`. Mengubah keputusan itu nanti = mengubah SATU
 * baris di tabel ini, dan guard serta onboarding ikut serentak — itulah alasan
 * keduanya dilarang menulis daftarnya sendiri.
 */

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
 * Label tampilan Bahasa Indonesia. HANYA kosmetik — keputusan boleh/tidaknya
 * selalu dari `ENTITLEMENTS`, dan tes memastikan tidak ada kapabilitas tanpa label.
 */
export const CAPABILITY_LABEL: Readonly<Record<Capability, string>> = {
  PRODUCT_QA: 'Tanya jawab produk Pralon',
  RECOMMENDATION: 'Rekomendasi produk',
  CLARIFICATION: 'Pertanyaan klarifikasi',
  TECHNICAL_HANDOFF: 'Kirim ke tim teknis Pralon',
  CONVERSATION_HISTORY: 'Riwayat percakapan tersimpan',
  SAVE_SOLUTION: 'Simpan solusi',
  CASE_ANALYSIS: 'Analisis studi kasus',
  MATERIAL_BOM: 'Estimasi material & BOM',
  SCHEMATIC: 'Skema instalasi',
  REPORT_PDF: 'Laporan PDF',
};

export interface OnboardingBenefit {
  readonly capability: Capability;
  readonly label: string;
  readonly tag: OnboardingTag;
}

/**
 * Enam manfaat onboarding langkah 5 (docs/API_CONTRACTS.md): kapabilitas yang
 * TIDAK dimiliki tamu — itulah yang layak dijual di layar "Pengalaman lebih
 * lengkap". Angka enamnya bukan konstanta yang dijaga; ia konsekuensi tabel, dan
 * berubah bila tabelnya berubah.
 */
export function onboardingBenefits(): readonly OnboardingBenefit[] {
  return (Object.keys(ENTITLEMENTS) as Capability[])
    .filter((capability) => !ENTITLEMENTS[capability].includes('guest'))
    .map((capability) => ({
      capability,
      label: CAPABILITY_LABEL[capability],
      tag: onboardingTag(capability),
    }));
}
