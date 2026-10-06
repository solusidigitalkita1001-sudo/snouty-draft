/**
 * Proyeksi state lama → EngineeringState. Yang dipaku: nilai pengguna = known, default/rentang =
 * assumed, asumsi registry yang dipakai punya ID, dan kesiapan berbeda per keluaran.
 */
import { describe, expect, it } from 'vitest';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import {
  appliedAssumptionsToView,
  engineeringStateFrom,
  irrigationFieldFor,
} from './engineering-state.js';

const T0 = '2026-01-01T00:00:00.000Z';
const withAnswers = (answers: Record<string, string>) => ({
  ...emptyRequirementState(T0),
  useCase: { kind: 'irrigation' as const, answers },
});

describe('engineeringStateFrom — irigasi', () => {
  it('kasus pemilik 1 ha sprinkler: luas known, jarak assumed (rentang), asumsi registry sprinkler + kecepatan', () => {
    const es = engineeringStateFrom(
      withAnswers({
        'irrigation.areaHa': '1 ha',
        'irrigation.source': 'Sungai / saluran',
        'irrigation.method': 'Sprinkler',
        'irrigation.distance': 'Di bawah 50 m',
        'irrigation.elevation': 'Sejajar',
      }),
    );
    expect(es.caseId).toBe('irrigation');
    expect(es.parameters.find((p) => p.key === 'total_area')).toMatchObject({
      value: 1,
      origin: 'known',
    });
    expect(es.parameters.find((p) => p.key === 'route_length')).toMatchObject({
      value: 25,
      origin: 'assumed',
    });
    const ids = es.appliedAssumptions.map((a) => a.id);
    expect(ids).toContain('IRRIGATION_PRELIMINARY_FLOW_SPRINKLER');
    expect(ids).toContain('DESIGN_VELOCITY_PLASTIC');
    expect(ids).not.toContain('HDPE_MAIN_FROM_200M');
    // jalur ≥ 200 m → asumsi HDPE ikut dipakai
    const far = engineeringStateFrom(withAnswers({ 'irrigation.distance': '200–500 m' }));
    expect(far.appliedAssumptions.map((a) => a.id)).toContain('HDPE_MAIN_FROM_200M');
  });

  it('kesiapan per keluaran: sizing pipa partial (jarak dari rentang), pompa missing (tinggi statis belum ada)', () => {
    const es = engineeringStateFrom(
      withAnswers({
        'irrigation.areaHa': '1 ha',
        'irrigation.method': 'Sprinkler',
        'irrigation.distance': '50–200 m',
      }),
    );
    expect(es.readiness.readiness.pipe_sizing).toBe('partial');
    expect(es.readiness.readiness.pump_sizing).toBe('missing_data');
    expect(es.readiness.missing.pump_sizing).toContain('static_head');
    expect(es.readiness.readiness.material_selection).toBe('partial');
  });

  it('kartu asumsi: setiap baris membawa assumptionId dan field irigasi yang bisa diperbaiki', () => {
    const es = engineeringStateFrom(withAnswers({ 'irrigation.method': 'Tetes' }));
    const rows = appliedAssumptionsToView(es.appliedAssumptions, irrigationFieldFor, 'ENG-101');
    expect(rows[0]).toMatchObject({
      assumptionId: 'IRRIGATION_PRELIMINARY_FLOW_DRIP',
      fieldPath: 'irrigation.method',
      ruleId: 'ENG-101',
    });
    expect(rows[0]!.text).toContain('0,5 liter/detik');
  });
});

describe('engineeringStateFrom — bangunan', () => {
  it('nilai pengguna known, default_applied assumed + asumsi registry-nya tercatat', () => {
    const base = emptyRequirementState(T0);
    const es = engineeringStateFrom({
      ...base,
      building: {
        ...base.building,
        floors: { value: 2, provenance: 'VERIFIED', source: 'user_stated', updatedAt: T0 },
        floorHeightM: {
          value: 3.5,
          provenance: 'ASSUMED',
          source: 'default_applied',
          reason: 'ENG-004',
          updatedAt: T0,
        },
      },
      water: {
        ...base.water,
        source: {
          value: 'rooftop_tank',
          provenance: 'ASSUMED',
          source: 'default_applied',
          reason: 'ENG-014',
          updatedAt: T0,
        },
      },
    });
    expect(es.caseId).toBe('residential_clean_water');
    expect(es.parameters.find((p) => p.key === 'building_floors')).toMatchObject({
      value: 2,
      origin: 'known',
    });
    expect(es.parameters.find((p) => p.key === 'building_height')).toMatchObject({
      value: 7,
      origin: 'assumed',
    });
    const ids = es.appliedAssumptions.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['FLOOR_HEIGHT_3_5M', 'SOURCE_ROOFTOP_TANK']));
    expect(ids).not.toContain('FLUID_CLEAN_WATER');
    expect(es.readiness.readiness.pipe_sizing).toBe('missing_data'); // panjang jalur belum ada
  });
});
