/**
 * P5-03a — **TES RELEASE BLOCKER**: aturan `REQUIRES_DOMAIN_VALIDATION` tidak pernah
 * menghasilkan `VERIFIED` (docs/EVALUATION.md, invarian P-2). Jangan pernah di-skip.
 */
import { describe, expect, it } from 'vitest';
import type { Provenance } from '@snouty/shared-types';
import type { RuleValidationStatus } from '@snouty/engineering';
import { gateProvenance, mayRenderVerified } from './provenance-gate.js';

const ALL_PROVENANCE: readonly Provenance[] = ['VERIFIED', 'ASSUMED', 'ESTIMATED', 'UNAVAILABLE'];
const ALL_STATUS: readonly RuleValidationStatus[] = [
  'REQUIRES_DOMAIN_VALIDATION',
  'VALIDATED',
  'REJECTED',
];

describe('Policy 4 — gerbang provenance (RELEASE BLOCKER)', () => {
  it('aturan belum divalidasi tidak pernah menghasilkan VERIFIED, untuk permintaan apa pun', () => {
    for (const requested of ALL_PROVENANCE) {
      const result = gateProvenance({ ruleStatus: 'REQUIRES_DOMAIN_VALIDATION', requested });
      expect(result).not.toBe('VERIFIED');
    }
  });

  it('VERIFIED yang diminta atas aturan belum divalidasi turun menjadi ASUMSI', () => {
    expect(
      gateProvenance({ ruleStatus: 'REQUIRES_DOMAIN_VALIDATION', requested: 'VERIFIED' }),
    ).toBe('ASSUMED');
  });

  it('tidak menaikkan provenance yang sudah lebih rendah', () => {
    expect(
      gateProvenance({ ruleStatus: 'REQUIRES_DOMAIN_VALIDATION', requested: 'ESTIMATED' }),
    ).toBe('ESTIMATED');
    expect(
      gateProvenance({ ruleStatus: 'REQUIRES_DOMAIN_VALIDATION', requested: 'UNAVAILABLE' }),
    ).toBe('UNAVAILABLE');
  });

  it('aturan VALIDATED membiarkan VERIFIED lewat', () => {
    expect(gateProvenance({ ruleStatus: 'VALIDATED', requested: 'VERIFIED' })).toBe('VERIFIED');
  });

  it('aturan REJECTED tidak pernah menampilkan nilai apa pun', () => {
    for (const requested of ALL_PROVENANCE) {
      expect(gateProvenance({ ruleStatus: 'REJECTED', requested })).toBe('UNAVAILABLE');
    }
  });

  it('hanya VERIFIED yang boleh merender tag TERVERIFIKASI', () => {
    expect(mayRenderVerified('VERIFIED')).toBe(true);
    for (const p of ALL_PROVENANCE.filter((x) => x !== 'VERIFIED')) {
      expect(mayRenderVerified(p)).toBe(false);
    }
  });

  it('seluruh kombinasi status × provenance: VERIFIED hanya dari aturan VALIDATED', () => {
    for (const ruleStatus of ALL_STATUS) {
      for (const requested of ALL_PROVENANCE) {
        const result = gateProvenance({ ruleStatus, requested });
        if (result === 'VERIFIED') {
          expect(ruleStatus).toBe('VALIDATED');
          expect(requested).toBe('VERIFIED');
        }
      }
    }
  });
});
