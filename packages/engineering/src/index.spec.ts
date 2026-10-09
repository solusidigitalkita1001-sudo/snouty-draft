/**
 * P6-01a — kontrak registry dan invarian yang berlaku atas SELURUH aturan.
 * docs/ENGINEERING_RULES.md §6 · invarian R-1, P-1.
 */
import { describe, expect, it } from 'vitest';
import { ALL_RULES, RULE_REGISTRY, RuleRegistrationError, RuleRegistry } from './index.js';

describe('registry aturan teknik', () => {
  it('memuat keempat belas aturan', () => {
    expect(ALL_RULES).toHaveLength(39);
    expect(RULE_REGISTRY.all()).toHaveLength(39);
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

  it('semua 39 aturan (14 bangunan + 5 irigasi + 6 bertekanan + 4 kolam + 5 gravitasi/jaringan + 5 gedung bertingkat) masih menunggu validasi ahli domain (OQ-06)', () => {
    expect(RULE_REGISTRY.awaitingValidation()).toHaveLength(39);
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
    expect(RULE_REGISTRY.latest('ENG-002')?.version).toBe(1);
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
