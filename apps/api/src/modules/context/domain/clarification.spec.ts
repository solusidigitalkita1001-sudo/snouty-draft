/**
 * P4-05a — klarifikasi mengikuti urutan prioritas dan tidak pernah > 4 (§9 #7).
 */
import { describe, expect, it } from 'vitest';
import type { RequirementFieldPath } from '@snouty/shared-types';
import { MAX_CLARIFICATION_QUESTIONS, planClarification } from './clarification.js';

describe('ClarificationEngine', () => {
  it('tanpa field kurang → tidak ada rencana', () => {
    expect(planClarification([])).toBeNull();
  });

  it('1–2 field kurang → bentuk tunggal, satu pertanyaan, tanpa skip', () => {
    const plan = planClarification(['building.floors', 'fixtures.bathrooms'])!;
    expect(plan.form).toBe('single');
    expect(plan.questions).toHaveLength(1);
    expect(plan.allowSkipToDefaults).toBe(false);
  });

  it('≥ 3 field kurang → bentuk kartu dengan opsi pakai asumsi standar', () => {
    const plan = planClarification(['building.floors', 'fixtures.bathrooms', 'water.source'])!;
    expect(plan.form).toBe('card');
    expect(plan.allowSkipToDefaults).toBe(true);
  });

  it('mengikuti urutan prioritas: sumber air lebih dulu', () => {
    const plan = planClarification(['fixtures.bathrooms', 'water.source'])!;
    // bentuk tunggal memakai field berprioritas tertinggi
    expect(plan.questions[0]!.id).toBe('water.source');
  });

  it('kartu mengurutkan penuh menurut prioritas', () => {
    const plan = planClarification([
      'fixtures.bathrooms',
      'building.floors',
      'water.installationType',
      'water.source',
    ])!;
    expect(plan.questions.map((q) => q.id)).toEqual([
      'water.source',
      'water.installationType',
      'building.floors',
      'fixtures.bathrooms',
    ]);
  });

  it('tidak pernah lebih dari empat pertanyaan', () => {
    const many: RequirementFieldPath[] = [
      'water.source',
      'water.installationType',
      'building.floors',
      'fixtures.bathrooms',
      'fixtures.basins',
      'fixtures.kitchens',
    ];
    const plan = planClarification(many)!;
    expect(plan.questions.length).toBeLessThanOrEqual(MAX_CLARIFICATION_QUESTIONS);
  });

  it('setiap pertanyaan selalu menawarkan "Belum tahu"', () => {
    const plan = planClarification(['water.source'])!;
    expect(plan.questions[0]!.allowUnknown).toBe(true);
  });
});
