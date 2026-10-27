/**
 * P6-01a — kontrak registry dan invarian yang berlaku atas SELURUH aturan.
 * docs/ENGINEERING_RULES.md §6 · invarian R-1, P-1.
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_RULES,
  HUNTER_TABLE_MAX_WSFU,
  ruleStandard,
  RULE_REGISTRY,
  RuleRegistrationError,
  RuleRegistry,
  supplyLoadWsfu,
} from './index.js';

describe('kutipan kode plambing', () => {
  // Permintaan pemilik 2026-10-27: hitungan teknis menyebut sumbernya, dan salah satu
  // pedoman yang dipakai Pralon adalah UPC — jadi kode yang diikuti sebuah angka harus
  // tertulis pada aturannya, bukan hanya di dokumen.
  it('aturan yang membaca tabel kode mengutip kodenya; aturan turunan rumus tidak', () => {
    expect(ruleStandard('ENG-601')).toBe('IPC Table 709.1');
    expect(ruleStandard('ENG-604')).toBe('IPC 2021 Table 710.1(2)');
    // Beban alatnya dari UPC, konversinya ke debit dari kurva IPC — keduanya disebut.
    expect(ruleStandard('ENG-701')).toBe('UPC Table A 103.1; IPC Appendix E, Table E103.3(3)');
    expect(ruleStandard('ENG-801')).toContain('UPC Table A 103.1');
    expect(ruleStandard('ENG-101')).toBeNull();
  });

  it('angka dari kode plambing tidak pernah tanpa kutipan', () => {
    const uncited = ALL_RULES.filter(
      (rule) => /\b(IPC|UPC|SNI)\b/.test(rule.sourceReference ?? '') && rule.standard === undefined,
    ).map((rule) => rule.ruleId);
    expect(uncited).toEqual([]);
  });
});

describe('beban alat suplai dari kebutuhan (WSFU)', () => {
  // Produksi 2026-10-27: sekolah 3 lantai dengan 24 toilet. Debit puncaknya di luar kurva
  // Hunter, dan sampai P31-69 itu muncul sebagai analisis yang gagal tanpa penjelasan.
  // Dengan beban alat UPC (kolom umum: kloset 2,5 + keran 1,0 per toilet) batas itu
  // tercapai di 29 toilet, bukan 20 — sekolah sedang kini dihitung, bukan diserahkan.
  it('toilet umum: 30 toilet = 105 WSFU, di atas tabel; 24 toilet masih di dalamnya', () => {
    expect(supplyLoadWsfu({ buildingType: 'public_building', bathrooms: 30 })).toBe(105);
    expect(supplyLoadWsfu({ buildingType: 'public_building', bathrooms: 30 })).toBeGreaterThan(
      HUNTER_TABLE_MAX_WSFU,
    );
    expect(supplyLoadWsfu({ buildingType: 'public_building', bathrooms: 24 })).toBe(84);
    // Rumah: 3 kamar mandi (kloset 2,5 + shower 2,0), 3 wastafel 1,0, 1 dapur 1,5 = 18.
    expect(supplyLoadWsfu({ buildingType: 'residential', bathrooms: 3 })).toBe(18);
    expect(supplyLoadWsfu({ buildingType: 'residential', bathrooms: null })).toBe(1.5);
  });

  it('urinoir dan wastafel yang disebut ikut dihitung', () => {
    const base = supplyLoadWsfu({ buildingType: 'place_of_worship', bathrooms: 4 });
    const withUrinals = supplyLoadWsfu({
      buildingType: 'place_of_worship',
      bathrooms: 4,
      urinals: 2,
    });
    expect(withUrinals - base).toBe(6); // 2 × 3 WSFU urinoir kolom pertemuan
  });
});

describe('registry aturan teknik', () => {
  it('memuat keempat belas aturan', () => {
    expect(ALL_RULES).toHaveLength(74);
    expect(RULE_REGISTRY.all()).toHaveLength(74);
  });

  it('memakai ID + versi yang unik', () => {
    const keys = ALL_RULES.map((r) => `${r.ruleId}@v${r.version}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('setiap aturan punya setidaknya satu test case (invarian R-1)', () => {
    for (const rule of ALL_RULES) {
      expect(rule.testCases.length).toBeGreaterThan(0);
    }
  });

  it('menolak pendaftaran aturan tanpa test case', () => {
    const registry = new RuleRegistry();
    expect(() =>
      registry.register({
        ruleId: 'ENG-999',
        version: 1,
        category: 'load_sizing',
        parseInput: () => ({}),
        compute: () => ({}),
        validationStatus: 'REQUIRES_DOMAIN_VALIDATION',
        testCases: [],
        explain: () => '',
      }),
    ).toThrow(RuleRegistrationError);
  });

  it('menolak mendaftarkan versi yang sama dua kali', () => {
    const registry = new RuleRegistry();
    const rule = ALL_RULES[0]!;
    registry.register(rule);
    expect(() => registry.register(rule)).toThrow(/sudah terdaftar/);
  });

  it('semua 74 aturan (12 bangunan + 5 irigasi + 7 bertekanan + 4 kolam + 18 gravitasi/jaringan + 6 gedung bertingkat + 5 pembuangan rumah + 11 air bersih rumah + 3 tempat ibadah + 4 renovasi) masih menunggu validasi ahli domain (OQ-06)', () => {
    expect(RULE_REGISTRY.awaitingValidation()).toHaveLength(74);
  });

  it('tidak ada aturan VALIDATED tanpa jejak sumber (invarian P-1)', () => {
    for (const rule of ALL_RULES) {
      if (rule.validationStatus === 'VALIDATED') {
        expect(rule.sourceReference).toBeDefined();
        expect(rule.validatedBy).toBeDefined();
      }
    }
  });

  it('setiap aturan mencatat dari mana angkanya berasal', () => {
    for (const rule of ALL_RULES) {
      expect(rule.sourceReference, `${rule.ruleId} tanpa sourceReference`).toBeTruthy();
    }
  });

  it('latest mengembalikan versi tertinggi', () => {
    expect(RULE_REGISTRY.latest('ENG-003')?.version).toBe(2);
    // Aturan yang dihapus (ENG-002, ENG-009, ENG-011) tidak terdaftar lagi.
    expect(RULE_REGISTRY.latest('ENG-009')).toBeNull();
    expect(RULE_REGISTRY.latest('ENG-999')).toBeNull();
  });
});

describe('test case setiap aturan benar-benar lulus', () => {
  // Inti pengujian engine: test case yang dideklarasikan aturan DIJALANKAN, bukan
  // sekadar didata. Aturan yang test case-nya bohong lebih buruk daripada tanpa tes.
  for (const rule of ALL_RULES) {
    for (const testCase of rule.testCases) {
      it(`${rule.ruleId}: ${testCase.name}`, () => {
        const parsed = rule.parseInput(testCase.input);
        expect(rule.compute(parsed)).toEqual(testCase.expected);
      });
    }
  }
});

describe('kemurnian compute', () => {
  it('masukan sama selalu menghasilkan keluaran sama', () => {
    for (const rule of ALL_RULES) {
      const first = rule.compute(rule.parseInput(rule.testCases[0]!.input));
      const second = rule.compute(rule.parseInput(rule.testCases[0]!.input));
      expect(second).toEqual(first);
    }
  });

  it('explain menghasilkan kalimat untuk setiap aturan', () => {
    for (const rule of ALL_RULES) {
      const input = rule.parseInput(rule.testCases[0]!.input);
      const text = rule.explain(input, rule.compute(input));
      expect(text.length, `${rule.ruleId} tanpa penjelasan`).toBeGreaterThan(10);
    }
  });
});

describe('judul langkah hitung', () => {
  it('setiap aturan terdaftar punya judul yang bisa dibaca pengguna', async () => {
    const { hasStepTitle, ruleStepTitle } = await import('./index.js');
    for (const rule of ALL_RULES) {
      expect(hasStepTitle(rule.ruleId), rule.ruleId).toBe(true);
      expect(ruleStepTitle(rule.ruleId, 'id')).not.toMatch(/ENG-/);
    }
  });
});
