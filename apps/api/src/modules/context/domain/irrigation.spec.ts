/**
 * Jalur irigasi (OQ-47): fakta tersurat terbaca dari kalimat, pertanyaan mengikuti prioritas
 * dan maksimum empat, "Belum tahu" tidak menimpa jawaban, lengkap = semua field wajib terisi.
 */
import { describe, expect, it } from 'vitest';
import { emptyRequirementState } from './requirement-state.factory.js';
import {
  applyIrrigationAnswers,
  irrigationAnswerValue,
  irrigationCaptured,
  irrigationFactsFrom,
  isIrrigationComplete,
  isIrrigationMessage,
  planIrrigationClarification,
} from './irrigation.js';

const T0 = '2026-01-01T00:00:00.000Z';

describe('irigasi', () => {
  it('"irigasi sawah 1 hektar … pompa dari sungai, jarak 300 meter" → fakta tersurat', () => {
    expect(isIrrigationMessage('untuk bikin irigasi sawah dengan luas 1 hektar')).toBe(true);
    expect(isIrrigationMessage('rumah 2 lantai')).toBe(false);
    expect(
      irrigationFactsFrom(
        'irigasi sawah 1 hektar, pakai pompa dari sungai, jaraknya 300 meter, irigasi tetes',
      ),
    ).toEqual({
      'irrigation.areaHa': '1 ha',
      'irrigation.source': 'Sungai / saluran',
      'irrigation.method': 'Tetes',
      'irrigation.distance': '200–500 m',
      'irrigation.pump': 'Ya',
    });
    expect(irrigationFactsFrom('irigasi kebun 2,5 ha')).toEqual({ 'irrigation.areaHa': '2,5 ha' });
  });

  it('kartu: yang kurang saja, prioritas sumber → luas → jenis → jarak → beda tinggi, maks 4', () => {
    const { state } = applyIrrigationAnswers(emptyRequirementState(T0), {
      'irrigation.areaHa': '1 ha',
    });
    const questions = planIrrigationClarification(state);
    expect(questions.map((q) => q.id)).toEqual([
      'irrigation.source',
      'irrigation.method',
      'irrigation.distance',
      'irrigation.elevation',
    ]);
    expect(questions.every((q) => q.allowUnknown)).toBe(true);
    expect(isIrrigationComplete(state)).toBe(false);
  });

  it('jawaban chip divalidasi terhadap templat; "Belum tahu" sah tetapi tidak menimpa; lengkap → handoff', () => {
    expect(irrigationAnswerValue('irrigation.source', 'PDAM')).toBe('PDAM');
    expect(irrigationAnswerValue('irrigation.source', 'Laut')).toBeNull();
    expect(irrigationAnswerValue('irrigation.distance', '200-500 m')).toBe('200–500 m'); // tanda pisah apa pun
    expect(irrigationAnswerValue('irrigation.source', 'Belum tahu')).toBe('Belum tahu');

    let { state } = applyIrrigationAnswers(emptyRequirementState(T0), {
      'irrigation.source': 'Sungai / saluran',
      'irrigation.areaHa': '1–2 ha',
      'irrigation.method': 'Sprinkler',
      'irrigation.distance': 'Di atas 500 m',
      'irrigation.elevation': 'Lebih rendah',
    });
    expect(isIrrigationComplete(state)).toBe(true);
    ({ state } = applyIrrigationAnswers(state, { 'irrigation.source': 'Belum tahu' }));
    expect(
      (state.useCase?.kind === 'irrigation' ? state.useCase.answers : {})['irrigation.source'],
    ).toBe('Sungai / saluran');
    expect(irrigationCaptured(state)).toContainEqual({
      label: 'Sumber air',
      value: 'Sungai / saluran',
    });
    expect(irrigationCaptured(state)).toContainEqual({ label: 'Luas lahan', value: '1–2 ha' });
  });

  it('jalur irigasi tidak menyentuh field bangunan — mesin teknik tidak pernah melihatnya', () => {
    const { state } = applyIrrigationAnswers(emptyRequirementState(T0), {
      'irrigation.areaHa': '1 ha',
    });
    expect(state.building.floors.value).toBeNull();
    expect(state.fixtures.bathrooms.value).toBeNull();
    expect(state.completeness.filled).toBe(0);
  });
});

describe('irigasi dwibahasa', () => {
  const { state } = applyIrrigationAnswers(emptyRequirementState(T0), {
    'irrigation.areaHa': '1–2 ha',
  });

  it('id tidak berubah; en: pertanyaan Inggris, options tetap Indonesia, optionLabels Inggris', () => {
    expect(planIrrigationClarification(state, 'id')).toEqual(planIrrigationClarification(state));
    const en = planIrrigationClarification(state, 'en');
    const source = en.find((q) => q.id === 'irrigation.source')!;
    expect(source.question).toBe('Where does the water come from?');
    expect(source.options).toEqual(['Sungai / saluran', 'Sumur / pompa', 'Embung / kolam', 'PDAM']);
    expect(source.optionLabels).toEqual([
      'River / canal',
      'Well / pump',
      'Reservoir / pond',
      'Municipal water (PDAM)',
    ]);
    for (const q of en) expect(q.optionLabels).toHaveLength(q.options.length);
    expect(irrigationAnswerValue('irrigation.source', 'Sungai / saluran')).toBe('Sungai / saluran');
    expect(irrigationAnswerValue('irrigation.source', 'Belum tahu')).toBe('Belum tahu');
  });

  it('irrigationCaptured: label per bahasa, nilai apa adanya', () => {
    expect(irrigationCaptured(state, 'id')).toEqual([{ label: 'Luas lahan', value: '1–2 ha' }]);
    expect(irrigationCaptured(state, 'en')).toEqual([{ label: 'Land area', value: '1–2 ha' }]);
  });
});
