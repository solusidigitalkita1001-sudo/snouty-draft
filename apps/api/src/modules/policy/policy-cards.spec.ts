import { describe, expect, it } from 'vitest';
import { policyCard, TECHNICAL_SLA_HOURS } from './policy-cards.js';
import { competitorPolicy, NEUTRAL_CRITERIA, NEUTRAL_CRITERIA_EN, scopePolicy } from './scope.js';

describe('policyCard', () => {
  it('alur yang didukung tidak menghasilkan kartu', () => {
    expect(policyCard({ kind: 'supported' })).toBeNull();
  });

  it("'id': tiap butir kartu kriteria punya labelnya sendiri (tes FAQ 2026-10-12)", () => {
    expect(policyCard(competitorPolicy())).toEqual({
      kind: 'criteria',
      items: NEUTRAL_CRITERIA.map((c) => ({ label: c.label, detail: c.detail })),
    });
  });

  it("'en': kartu kriteria berstruktur sama dengan teks Inggris", () => {
    const card = policyCard(competitorPolicy('en'), [], 'en');
    expect(card).toEqual({
      kind: 'criteria',
      items: NEUTRAL_CRITERIA_EN.map((c) => ({ label: c.label, detail: c.detail })),
    });
  });

  it("'en': kartu unsupported membawa alasan Inggris, captured, dan SLA yang sama", () => {
    const outcome = scopePolicy({ buildingType: null, installationType: null, floors: 6 }, 'en');
    const captured = [{ label: 'Floors', value: '6' }];
    expect(policyCard(outcome, captured, 'en')).toEqual({
      kind: 'unsupported',
      reasons: ['A 6-storey building is outside the scope of automatic recommendations.'],
      captured,
      slaHours: TECHNICAL_SLA_HOURS,
    });
  });

  it('label butir kriteria tidak ada yang sama', () => {
    const labels = NEUTRAL_CRITERIA.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
