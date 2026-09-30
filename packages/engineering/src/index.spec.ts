import { describe, expect, it } from 'vitest';
import { RULE_REGISTRY, type RuleVersionMeta } from './index.js';

/**
 * Registry masih kosong sampai Fase 6, tetapi kontraknya berlaku sejak sekarang.
 * Tes ini ikut tumbuh bersama aturan pertama yang didaftarkan.
 */
describe('registry aturan teknik', () => {
  it('menandai setiap aturan dengan status validasi', () => {
    for (const rule of RULE_REGISTRY) {
      expect(rule.validationStatus).toBeDefined();
    }
  });

  it('tidak pernah menandai aturan VALIDATED tanpa jejak siapa yang memvalidasi', () => {
    // Invarian P-1 bersandar pada ini: status VALIDATED adalah satu-satunya jalan
    // menuju provenance VERIFIED, jadi ia harus selalu bisa ditelusuri ke seseorang.
    const validated = RULE_REGISTRY.filter((r) => r.validationStatus === 'VALIDATED');
    for (const rule of validated) {
      expect(Object.keys(rule)).toContain('sourceReference');
    }
  });

  it('memakai ID aturan yang unik', () => {
    const ids = RULE_REGISTRY.map((r: RuleVersionMeta) => `${r.ruleId}@${r.version}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
