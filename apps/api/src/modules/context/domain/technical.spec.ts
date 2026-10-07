/**
 * Jalur kasus teknis umum (Fase 14). Yang dipaku: deteksi kasus dan lanjutannya, fakta tersurat
 * jadi parameter `known`, "Belum tahu" tidak ditanya ulang, pertanyaan ≤ 4 berbahasa pengguna,
 * lengkap = tanpa parameter kritis yang kosong.
 */
import { describe, expect, it } from 'vitest';
import { emptyRequirementState } from './requirement-state.factory.js';
import {
  applyTechnicalAnswers,
  applyTechnicalFacts,
  detectTechnicalCase,
  formatTechnicalValue,
  isTechnicalComplete,
  planTechnicalClarification,
  technicalAnswerValue,
  technicalCaptured,
  technicalGuidance,
  technicalMissing,
} from './technical.js';

const T0 = '2026-01-01T00:00:00.000Z';

describe('detectTechnicalCase', () => {
  it('rumah dan irigasi bukan jalur ini; gorong-gorong iya; percakapan teknis berlanjut apa pun pesannya', () => {
    const empty = emptyRequirementState(T0);
    expect(detectTechnicalCase('rumah 2 lantai 3 kamar mandi', empty)).toBeNull();
    expect(detectTechnicalCase('irigasi sawah 1 hektar', empty)).toBeNull();
    expect(detectTechnicalCase('mau pasang gorong-gorong melintasi jalan', empty)).toBe('culvert');
    const ongoing = applyTechnicalFacts(empty, 'pump_transfer', 'transfer air dari sungai').state;
    expect(detectTechnicalCase('jaraknya 800 meter', ongoing)).toBe('pump_transfer');
  });
});

describe('skenario D transfer pompa', () => {
  const start = applyTechnicalFacts(
    emptyRequirementState(T0),
    'pump_transfer',
    'mau transfer air dari sungai ke tandon, jaraknya 800 m, tandonnya 12 m lebih tinggi, debit 5 l/s',
  );

  it('fakta tersurat tercatat known dengan satuan; pertanyaan sisa ≤ 4, bahasa pengguna', () => {
    expect(start.changed).toBe(true);
    expect(start.state.useCase).toMatchObject({ kind: 'technical', caseId: 'pump_transfer' });
    const p = (
      start.state.useCase as { parameters: Record<string, { value: unknown; unit?: string }> }
    ).parameters;
    expect(p['route_length']).toMatchObject({ value: 800, unit: 'm', origin: 'known' });
    expect(p['static_head']).toMatchObject({ value: 12, unit: 'm' });
    expect(p['design_flow']).toMatchObject({ value: 5, unit: 'l/s' });
    expect(p['source_type']).toMatchObject({ value: 'Sungai / saluran' });
    const missing = technicalMissing(start.state);
    expect(missing.length).toBeLessThanOrEqual(4);
    expect(missing.map((m) => m.key)).not.toContain('route_length');
    expect(isTechnicalComplete(start.state)).toBe(true); // semua kritis sudah ada
    const text = technicalGuidance(start.state);
    expect(text).toContain('Oke, transfer air dengan pompa');
    expect(text).toContain('panjang jalur 800 m');
    expect(text).not.toMatch(/\*\*Data|Jawab langsung|asumsi awal yang ditandai/);
    expect(text).toContain('tolong jawab');
    expect(text).not.toMatch(/\d\s*(bar|mm|inci)\b/); // tanpa angka teknik hasil hitungan
  });

  it('jawaban kartu: enum kanonik, angka, boolean; "Belum tahu" jadi assumed dan tidak ditanya lagi', () => {
    expect(technicalAnswerValue('material', 'hdpe')).toEqual({ key: 'material', value: 'HDPE' });
    expect(technicalAnswerValue('pump_power', '2 HP')).toEqual({ key: 'pump_power', value: 2 });
    expect(technicalAnswerValue('pump_required', 'Ya')).toEqual({
      key: 'pump_required',
      value: true,
    });
    expect(technicalAnswerValue('material', 'asbes')).toBeNull();
    expect(technicalAnswerValue('bukan_parameter', 'x')).toBeNull();

    const answered = applyTechnicalAnswers(start.state, [
      { key: 'material', value: 'Belum tahu' },
      { key: 'required_pressure', value: 1.5 },
    ]);
    expect(answered.changed).toBe(true);
    const keys = technicalMissing(answered.state).map((m) => m.key);
    expect(keys).not.toContain('material');
    expect(keys).not.toContain('required_pressure');
    expect(technicalCaptured(answered.state).map((r) => r.label)).not.toContain('Bahan pipa');
  });
});

describe('skenario E gorong-gorong tanpa angka', () => {
  it('belum lengkap: kartu berisi pertanyaan berpilihan, angka ditanya di teks', () => {
    const r = applyTechnicalFacts(
      emptyRequirementState(T0),
      'culvert',
      'mau pasang gorong-gorong melintasi jalan desa',
    );
    expect(isTechnicalComplete(r.state)).toBe(false);
    const plan = planTechnicalClarification(r.state);
    expect(plan.card.map((q) => q.id)).toContain('traffic_load');
    expect(plan.card.every((q) => q.options.length > 1 && q.allowUnknown)).toBe(true);
    expect(plan.text.map((m) => m.key)).toEqual(
      expect.arrayContaining(['design_flow', 'road_width', 'slope']),
    );
    expect(technicalGuidance(r.state)).toContain('tolong jawab');
  });
});

describe('technical dwibahasa', () => {
  const state = applyTechnicalFacts(
    emptyRequirementState(T0),
    'culvert',
    'mau pasang gorong-gorong melintasi jalan desa',
  ).state;

  it('id tidak berubah; en berbahasa Inggris dengan struktur sama', () => {
    expect(technicalGuidance(state, 'id')).toBe(technicalGuidance(state));
    const en = technicalGuidance(state, 'en');
    expect(en).toContain('Okay, a culvert.');
    expect(en).toContain('please answer a few things:');
    expect(en).not.toContain('tolong jawab');
    expect(en.split('\n').filter((l) => l.startsWith('- ')).length).toBe(
      technicalGuidance(state)
        .split('\n')
        .filter((l) => l.startsWith('- ')).length,
    );
  });

  it('formatTechnicalValue: Ya/Tidak menjadi Yes/No; kartu boolean membawa optionLabels', () => {
    const p = { label: 'x', value: true, origin: 'known' as const };
    expect(formatTechnicalValue(p)).toBe('Ya');
    expect(formatTechnicalValue(p, 'en')).toBe('Yes');
    expect(formatTechnicalValue({ ...p, value: false }, 'en')).toBe('No');
    const boolQuestions = (locale: 'id' | 'en') =>
      planTechnicalClarification(state, locale).card.filter(
        (q) => q.options.length === 2 && q.options[0] === 'Ya',
      );
    for (const q of boolQuestions('id')) expect(q.optionLabels).toBeUndefined();
    for (const q of boolQuestions('en')) {
      expect(q.options).toEqual(['Ya', 'Tidak']);
      expect(q.optionLabels).toEqual(['Yes', 'No']);
    }
  });

  it('en: pertanyaan kartu dan label pilihan enum dari registry Inggris; nilai protokol tetap Indonesia', () => {
    const id = planTechnicalClarification(state, 'id');
    const en = planTechnicalClarification(state, 'en');
    expect(en.card.map((q) => q.id)).toEqual(id.card.map((q) => q.id));
    expect(en.text.map((m) => m.key)).toEqual(id.text.map((m) => m.key));
    en.card.forEach((q, i) => {
      expect(q.question).not.toBe(id.card[i]!.question);
      expect(q.options).toEqual(id.card[i]!.options);
      expect(q.optionLabels).toHaveLength(q.options.length);
      expect(q.optionLabels).not.toEqual(q.options);
    });
    for (const q of id.card) expect(q.optionLabels).toBeUndefined();
    // Pertanyaan angka di teks panduan juga Inggris.
    const guidance = technicalGuidance(state, 'en');
    for (const m of en.text) expect(guidance).toContain(`- ${m.questionEn}`);
  });

  it('en: label data yang tercatat dari registry Inggris, nilai dan urutan sama', () => {
    const captured = applyTechnicalFacts(
      emptyRequirementState(T0),
      'pump_transfer',
      'transfer water from a well to a tank, 5 liters per second, 800 m, 12 m higher',
    ).state;
    const id = technicalCaptured(captured, 'id');
    const en = technicalCaptured(captured, 'en');
    expect(en).toHaveLength(id.length);
    expect(id.map((r) => r.label)).toContain('Debit rencana');
    expect(en.map((r) => r.label)).toContain('Design flow');
    en.forEach((r, i) => expect(r.label).not.toBe(id[i]!.label));
    expect(technicalGuidance(captured, 'en')).toContain('design flow 5 l/s');
  });

  it('technicalAnswerValue menerima label Inggris dan Yes/No, hasilnya nilai protokol', () => {
    const enumQuestion = planTechnicalClarification(state, 'en').card.find(
      (q) => q.options[0] !== 'Ya',
    )!;
    const protocolValue = enumQuestion.options[0]!;
    const englishLabel = enumQuestion.optionLabels![0]!;
    expect(englishLabel).not.toBe(protocolValue);
    expect(technicalAnswerValue(enumQuestion.id, englishLabel)).toEqual({
      key: enumQuestion.id,
      value: protocolValue,
    });
    expect(technicalAnswerValue(enumQuestion.id, protocolValue)).toEqual({
      key: enumQuestion.id,
      value: protocolValue,
    });
    expect(technicalAnswerValue('pump_required', 'Yes')).toEqual({
      key: 'pump_required',
      value: true,
    });
    expect(technicalAnswerValue('pump_required', 'No')).toEqual({
      key: 'pump_required',
      value: false,
    });
  });
});
