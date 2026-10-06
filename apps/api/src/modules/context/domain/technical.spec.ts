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
