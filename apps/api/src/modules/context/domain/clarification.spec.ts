/**
 * P4-05a — klarifikasi mengikuti urutan prioritas dan tidak pernah > 4 (§9 #7).
 */
import { describe, expect, it } from 'vitest';
import type { RequirementFieldPath } from '@snouty/shared-types';
import {
  MAX_CLARIFICATION_QUESTIONS,
  answerToUpdate,
  isClarificationAnswerId,
  planClarification,
  summarizeAnswers,
} from './clarification.js';

describe('answerToUpdate — jawaban chip tanpa LLM', () => {
  const noDefault = () => null;
  const withDefault = (path: string) =>
    path === 'water.source'
      ? ({ path, value: 'rooftop_tank', source: 'default_applied' } as never)
      : null;

  it('label templat → nilai domain; angka → bilangan bulat', () => {
    expect(answerToUpdate({ id: 'water.source', option: 'PDAM' }, noDefault)).toEqual({
      path: 'water.source',
      value: 'municipal',
      source: 'user_stated',
    });
    expect(answerToUpdate({ id: 'water.installationType', option: 'Keduanya' }, noDefault)).toEqual(
      { path: 'water.installationType', value: 'both', source: 'user_stated' },
    );
    expect(answerToUpdate({ id: 'fixtures.bathrooms', option: '3' }, noDefault)).toEqual({
      path: 'fixtures.bathrooms',
      value: 3,
      source: 'user_stated',
    });
  });

  it('"Belum tahu" → default bila ada, kosong bila tidak; label asing → null, bukan tebakan', () => {
    expect(answerToUpdate({ id: 'water.source', option: 'Belum tahu' }, withDefault)).toMatchObject(
      { path: 'water.source', value: 'rooftop_tank', source: 'default_applied' },
    );
    expect(answerToUpdate({ id: 'building.floors', option: 'Belum tahu' }, withDefault)).toBeNull();
    expect(answerToUpdate({ id: 'water.source', option: 'Sungai' }, noDefault)).toBeNull();
    expect(answerToUpdate({ id: 'building.dimensions', option: '1' }, noDefault)).toBeNull();
  });

  it('ringkasan jawaban untuk gelembung pengguna', () => {
    expect(
      summarizeAnswers([
        { id: 'water.source', option: 'Toren atap' },
        { id: 'fixtures.bathrooms', option: '3' },
      ]),
    ).toBe('Sumber air: Toren atap · Kamar mandi: 3');
  });
});

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

  it('summarizeAnswers: jawaban kartu teknis memakai label registry, bukan kunci mentah ("fluid_type: …")', () => {
    expect(summarizeAnswers([{ id: 'fluid_type', option: 'Air limbah' }])).toBe(
      'Jenis cairan: Air limbah',
    );
    const en = summarizeAnswers([{ id: 'fluid_type', option: 'Air limbah' }], 'en');
    expect(en).not.toContain('fluid_type');
    expect(en).not.toContain('Air limbah');
    expect(summarizeAnswers([{ id: 'irrigation.method', option: 'Tetes' }], 'en')).not.toContain(
      'irrigation.',
    );
  });

  it('isClarificationAnswerId: field inti, field irigasi, dan kunci parameter teknis diterima; yang lain ditolak (bug 400, 2026-10-07)', () => {
    for (const id of [
      'water.source',
      'building.floors',
      'irrigation.method',
      'pump_required',
      'design_flow',
      'material',
    ]) {
      expect(isClarificationAnswerId(id), id).toBe(true);
    }
    for (const id of ['building.type', 'fixtures.outletCount', 'subject', 'DROP TABLE', '']) {
      expect(isClarificationAnswerId(id), id).toBe(false);
    }
  });
});
