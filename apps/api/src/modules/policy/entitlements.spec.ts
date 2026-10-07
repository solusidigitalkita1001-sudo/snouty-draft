/**
 * P3-09a — daftar manfaat DITURUNKAN dari tabel entitlement, bukan ditulis tangan.
 */
import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_LABEL,
  CAPABILITY_LABEL_EN,
  ENTITLEMENTS,
  isEntitled,
  onboardingBenefits,
  onboardingTag,
  onboardingTagLabel,
  type Capability,
} from './entitlements.js';

const ALL = Object.keys(ENTITLEMENTS) as Capability[];

describe('ENTITLEMENTS — bentuk tabel', () => {
  it('tidak punya kapabilitas tanpa tier sama sekali', () => {
    for (const capability of ALL) {
      expect(ENTITLEMENTS[capability].length, capability).toBeGreaterThan(0);
    }
  });

  it('tidak punya tier yang melompat: advanced selalu mencakup registered kecuali khusus advanced', () => {
    // Tabel yang memberi tamu sesuatu yang tidak dimiliki registered adalah tabel
    // yang salah ketik.
    for (const capability of ALL) {
      const tiers = ENTITLEMENTS[capability];
      if (tiers.includes('guest')) expect(tiers).toContain('registered');
      if (tiers.includes('registered')) expect(tiers).toContain('advanced');
    }
  });

  it('memberi setiap kapabilitas label tampilan', () => {
    for (const capability of ALL) {
      expect(CAPABILITY_LABEL[capability], capability).toBeTruthy();
    }
  });
});

describe('onboardingTag — diturunkan, bukan ditulis', () => {
  it('menandai kapabilitas tamu sebagai TAMU JUGA', () => {
    expect(onboardingTag('PRODUCT_QA')).toBe('TAMU JUGA');
  });

  it('menandai kapabilitas registered sebagai AKUN', () => {
    expect(onboardingTag('CONVERSATION_HISTORY')).toBe('AKUN');
    expect(onboardingTag('SAVE_SOLUTION')).toBe('AKUN');
  });

  it('menandai kapabilitas khusus advanced sebagai LANJUTAN', () => {
    expect(onboardingTag('MATERIAL_BOM')).toBe('LANJUTAN');
    expect(onboardingTag('REPORT_PDF')).toBe('LANJUTAN');
  });

  it('konsisten dengan tabel untuk SEMUA kapabilitas — bukan hanya contoh', () => {
    for (const capability of ALL) {
      const tiers = ENTITLEMENTS[capability];
      const tag = onboardingTag(capability);
      if (tag === 'TAMU JUGA') expect(tiers).toContain('guest');
      if (tag === 'AKUN') {
        expect(tiers).toContain('registered');
        expect(tiers).not.toContain('guest');
      }
      if (tag === 'LANJUTAN') expect(tiers).toEqual(['advanced']);
    }
  });
});

describe('onboardingBenefits', () => {
  it('mengikuti urutan dan isi kurasi desain layar 14 — enam item', () => {
    expect(onboardingBenefits().map((benefit) => benefit.capability)).toEqual([
      'CONVERSATION_HISTORY',
      'SAVE_SOLUTION',
      'CASE_ANALYSIS',
      'MATERIAL_BOM',
      'RECOMMENDATION',
      'SCHEMATIC',
    ]);
  });

  it('tag setiap manfaat DITURUNKAN dari tabel — dan cocok dengan yang digambar desainer', () => {
    const tags = Object.fromEntries(
      onboardingBenefits().map((benefit) => [benefit.capability, benefit.tag]),
    );

    expect(tags).toEqual({
      CONVERSATION_HISTORY: 'AKUN',
      SAVE_SOLUTION: 'AKUN',
      CASE_ANALYSIS: 'LANJUTAN',
      MATERIAL_BOM: 'LANJUTAN',
      RECOMMENDATION: 'TAMU JUGA',
      SCHEMATIC: 'LANJUTAN',
    });
  });

  it('setiap manfaat membawa label copy desain', () => {
    for (const benefit of onboardingBenefits()) {
      expect(benefit.label).toBeTruthy();
    }
  });
});

describe('isEntitled', () => {
  it('menjawab tiga pertanyaan yang akan ditanyakan guard', () => {
    expect(isEntitled('guest', 'PRODUCT_QA')).toBe(true);
    expect(isEntitled('guest', 'MATERIAL_BOM')).toBe(false);
    expect(isEntitled('registered', 'REPORT_PDF')).toBe(false);
    expect(isEntitled('advanced', 'REPORT_PDF')).toBe(true);
  });
});

describe('Entitlements dwibahasa (Fase 15)', () => {
  it('CAPABILITY_LABEL_EN punya kunci identik dengan CAPABILITY_LABEL', () => {
    expect(Object.keys(CAPABILITY_LABEL_EN).sort()).toEqual(Object.keys(CAPABILITY_LABEL).sort());
  });

  it("'id' tidak berubah; 'en' berbahasa Inggris dengan tag protokol yang sama", () => {
    const id = onboardingBenefits('id');
    expect(id).toEqual(onboardingBenefits());
    expect(id[0]).toEqual({
      capability: 'CONVERSATION_HISTORY',
      label: 'Riwayat percakapan',
      tag: 'AKUN',
    });
    const en = onboardingBenefits('en');
    expect(en[0]).toEqual({
      capability: 'CONVERSATION_HISTORY',
      label: 'Conversation history',
      tag: 'AKUN',
    });
    expect(en.map((b) => b.tag)).toEqual(id.map((b) => b.tag));
  });

  it('label tag per bahasa; Indonesia = nilai protokol', () => {
    expect(onboardingTagLabel('TAMU JUGA')).toBe('TAMU JUGA');
    expect(onboardingTagLabel('TAMU JUGA', 'en')).toBe('GUESTS TOO');
    expect(onboardingTagLabel('AKUN', 'en')).toBe('ACCOUNT');
    expect(onboardingTagLabel('LANJUTAN', 'en')).toBe('ADVANCED');
  });
});
