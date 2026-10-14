/**
 * P4-05a — klarifikasi mengikuti urutan prioritas dan tidak pernah > 4 (§9 #7).
 */
import { describe, expect, it } from 'vitest';
import type { RequirementFieldPath } from '@snouty/shared-types';
import {
  MAX_CLARIFICATION_QUESTIONS,
  answerToUpdate,
  houseRefinementQuestions,
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

describe('pertanyaan penyempurna rumah (2026-10-12)', () => {
  it('ukuran rumah, dapur, wastafel yang belum disebut; jawaban ukuran jadi panjang × lebar', () => {
    const questions = houseRefinementQuestions((path) => path === 'fixtures.basins');
    expect(questions.map((q) => q.id)).toEqual(['building.dimensions', 'fixtures.kitchens']);
    expect(
      answerToUpdate({ id: 'building.dimensions', option: 'lengthM=8;widthM=15' }, () => null),
    ).toEqual({
      path: 'building.dimensions',
      value: { lengthM: 8, widthM: 15 },
      source: 'user_stated',
    });
    expect(answerToUpdate({ id: 'fixtures.kitchens', option: '0' }, () => null)).toEqual({
      path: 'fixtures.kitchens',
      value: 0,
      source: 'user_stated',
    });
  });
});

describe('ukuran bangunan dan tanah diisi sendiri (2026-10-12)', () => {
  const answer = (option: string) =>
    answerToUpdate({ id: 'building.dimensions', option }, () => null);

  it('kartu ukuran berisi isian angka, bukan pilihan tetap; bangunan wajib, tanah opsional', () => {
    const [question] = houseRefinementQuestions((path) => path !== 'building.dimensions');
    expect(question!.options).toEqual([]);
    expect(question!.inputs!.map((i) => [i.group, i.label, i.required])).toEqual([
      ['Bangunan', 'Panjang', true],
      ['Bangunan', 'Lebar', true],
      ['Tanah', 'Panjang', false],
      ['Tanah', 'Lebar', false],
    ]);
  });

  it('bangunan dan tanah tersimpan terpisah; desimal koma dibaca', () => {
    expect(answer('lengthM=8;widthM=12,5;landLengthM=10;landWidthM=20')?.value).toEqual({
      lengthM: 8,
      widthM: 12.5,
      landLengthM: 10,
      landWidthM: 20,
    });
  });

  it('isian tidak lengkap, di luar batas, atau kunci asing → null, bukan tebakan', () => {
    expect(answer('lengthM=8')).toBeNull();
    expect(answer('landLengthM=10;landWidthM=20')).toBeNull();
    expect(answer('lengthM=8;widthM=12;landLengthM=10')).toBeNull();
    expect(answer('lengthM=1;widthM=12')).toBeNull();
    expect(answer('lengthM=8;widthM=12;mainRunMeters=30')).toBeNull();
  });

  it('gelembung pengguna menyebut keduanya', () => {
    expect(
      summarizeAnswers([
        { id: 'building.dimensions', option: 'lengthM=8;widthM=12;landLengthM=10;landWidthM=20' },
      ]),
    ).toBe('Ukuran: bangunan 8 × 12 m, tanah 10 × 20 m');
  });
});

describe('kedalaman sumur (review putaran 3, 1b)', () => {
  it('ditanya di kartu penyempurna hanya bila sumbernya sumur', () => {
    const known = () => false;
    expect(houseRefinementQuestions(known, 'id', 'residential', 'pump').map((q) => q.id)).toContain(
      'water.wellDepthM',
    );
    expect(
      houseRefinementQuestions(known, 'id', 'residential', 'rooftop_tank').map((q) => q.id),
    ).not.toContain('water.wellDepthM');
  });

  it('pilihan rentang dihitung dengan batas atasnya; angka pasti dipakai apa adanya', () => {
    const answer = (option: string) =>
      answerToUpdate({ id: 'water.wellDepthM', option }, () => null);
    expect(answer('< 5 m')).toMatchObject({ value: 5, source: 'user_stated' });
    expect(answer('5–9 m')).toMatchObject({ value: 9 });
    expect(answer('> 9 m')).toMatchObject({ value: 10 });
    expect(answer('value=8')).toMatchObject({ value: 8 });
    // "Belum tahu" tanpa default → kosong; engine memakai asumsi 6 m.
    expect(answer('Belum tahu')).toBeNull();
    expect(isClarificationAnswerId('water.wellDepthM')).toBe(true);
  });
});

describe('label pilihan (review putaran 3, 3c/3e)', () => {
  it('jenis instalasi memakai label yang sama dengan panel; nama lama tetap dibaca', () => {
    expect(planClarification(['water.installationType'])!.questions[0]!.options).toEqual([
      'Air bersih',
      'Pembuangan',
      'Air bersih + pembuangan',
    ]);
    for (const option of ['Air bersih + pembuangan', 'Keduanya']) {
      expect(answerToUpdate({ id: 'water.installationType', option }, () => null)).toMatchObject({
        value: 'both',
      });
    }
  });

  it('wastafel ditanya total, termasuk yang di kamar mandi', () => {
    const [question] = houseRefinementQuestions((path) => path !== 'fixtures.basins');
    expect(question!.question).toBe('Ada berapa wastafel total, termasuk yang di kamar mandi?');
  });
});

describe('kedalaman sumur — setiap pilihan memetakan nilainya sendiri (review putaran 4, 6c)', () => {
  it.each([
    ['< 5 m', 5],
    ['5–9 m', 9],
    ['> 9 m', 10],
  ])('%s → %d m', (option, metres) => {
    expect(answerToUpdate({ id: 'water.wellDepthM', option }, () => null)).toMatchObject({
      path: 'water.wellDepthM',
      value: metres,
    });
  });
});
