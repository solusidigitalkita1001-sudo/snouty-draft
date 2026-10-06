/**
 * Label jawaban irigasi → masukan engine. Yang dipaku: luas tersurat dipakai apa adanya,
 * rentang diambil titik tengahnya DAN dicatat sebagai asumsi, "Belum tahu"/kosong → nilai
 * asumsi yang juga tercatat — tidak ada pengisian diam-diam.
 */
import { describe, expect, it } from 'vitest';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import { irrigationInputFrom } from './irrigation-input.js';

const T0 = '2026-01-01T00:00:00.000Z';
const withAnswers = (answers: Record<string, string>) => ({
  ...emptyRequirementState(T0),
  useCase: { kind: 'irrigation' as const, answers },
});

describe('irrigationInputFrom', () => {
  it('kasus pemilik: 1 ha, sungai, sprinkler, <50 m, sejajar → tanpa asumsi selain jarak (titik tengah)', () => {
    const { input, assumptions } = irrigationInputFrom(
      withAnswers({
        'irrigation.areaHa': '1 ha',
        'irrigation.source': 'Sungai / saluran',
        'irrigation.method': 'Sprinkler',
        'irrigation.distance': 'Di bawah 50 m',
        'irrigation.elevation': 'Sejajar',
      }),
    );
    expect(input).toEqual({
      areaHa: 1,
      method: 'sprinkler',
      mainRunMeters: 25,
      elevation: 'level',
    });
    expect(assumptions.map((a) => a.fieldPath)).toEqual(['irrigation.distance']);
  });

  it('rentang luas dan jawaban kosong → nilai asumsi yang tercatat per field', () => {
    const { input, assumptions } = irrigationInputFrom(
      withAnswers({ 'irrigation.areaHa': '1–2 ha', 'irrigation.method': 'Belum tahu' }),
    );
    expect(input.areaHa).toBe(1.5);
    expect(input.method).toBe('flood');
    expect(input.mainRunMeters).toBe(125);
    expect(input.elevation).toBe('level');
    expect(assumptions.map((a) => a.fieldPath).sort()).toEqual([
      'irrigation.areaHa',
      'irrigation.distance',
      'irrigation.elevation',
      'irrigation.method',
    ]);
  });
});
