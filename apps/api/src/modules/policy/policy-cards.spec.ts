import { describe, expect, it } from 'vitest';
import { policyCard, TECHNICAL_SLA_HOURS } from './policy-cards.js';
import { competitorPolicy, NEUTRAL_CRITERIA, NEUTRAL_CRITERIA_EN, scopePolicy } from './scope.js';

describe('policyCard', () => {
  it('alur yang didukung tidak menghasilkan kartu', () => {
    expect(policyCard({ kind: 'supported' })).toBeNull();
  });

  it("'id' tidak berubah: kartu kriteria berlabel Kriteria", () => {
    expect(policyCard(competitorPolicy())).toEqual({
      kind: 'criteria',
      items: NEUTRAL_CRITERIA.map((detail) => ({ label: 'Kriteria', detail })),
    });
  });

  it("'en': kartu kriteria berstruktur sama dengan teks Inggris", () => {
    const card = policyCard(competitorPolicy('en'), [], 'en');
    expect(card).toEqual({
      kind: 'criteria',
      items: NEUTRAL_CRITERIA_EN.map((detail) => ({ label: 'Criterion', detail })),
    });
  });

  it("'en': kartu unsupported membawa alasan Inggris, captured, dan SLA yang sama", () => {
    const outcome = scopePolicy(
      { buildingType: 'industrial', installationType: null, floors: null },
      'en',
    );
    const captured = [{ label: 'Floors', value: '2' }];
    expect(policyCard(outcome, captured, 'en')).toEqual({
      kind: 'unsupported',
      reasons: ['Industrial installations require review by the Pralon technical team.'],
      captured,
      slaHours: TECHNICAL_SLA_HOURS,
    });
  });
});
