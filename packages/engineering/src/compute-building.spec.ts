/**
 * Gedung bertingkat (keputusan pemilik 2026-10-09): "gedung 100 x 30, 12 lantai" dihitung —
 * kebutuhan, zona, pompa transfer, riser — dengan setiap nilai asumsi tercatat dan tidak VERIFIED.
 */
import { describe, expect, it } from 'vitest';
import { extractTechnicalContext } from './cases/extractor.js';
import { caseProfile, resolveMissingParameters } from './index.js';
import { BuildingOccupancyUnknownError, computeBuildingWater } from './compute-building.js';

const CASE = 'multistorey_building_water' as const;

describe('computeBuildingWater', () => {
  it('gedung 12 lantai, denah 100 × 30 m: penghuni dari luas, dua zona, transfer dan riser', () => {
    const r = computeBuildingWater({ floors: 12, floorAreaM2: 3000 });
    expect(r.occupants).toBe(3600);
    expect(r.occupantsEstimated).toBe(true);
    expect(r.demand).toEqual({
      dailyM3: 540,
      averageHourM3h: 54,
      peakHourLs: 30,
      peakMinuteLs: 45,
    });
    expect(r.zoning).toMatchObject({
      buildingHeightM: 42,
      zones: 2,
      reducedZones: 1,
      boosterFloors: 2,
    });
    // Tangki bawah = 1 hari; tangki atap = (45 − 30 l/s) × 30 menit + 30 l/s × 10 menit.
    expect(r.tanks).toEqual({
      groundTankM3: 540,
      roofPeakDeficitM3: 27,
      roofPumpCycleM3: 18,
      roofTankM3: 45,
    });
    expect(r.appliedAssumptionIds).toEqual(
      expect.arrayContaining(['GROUND_TANK_1_DAY', 'PEAK_DURATION_30MIN', 'PUMP_CYCLE_10MIN']),
    );
    expect(r.transfer.recommendedSize).toBe('6"');
    expect(r.transfer.allCriteriaMet).toBe(true);
    expect(r.transfer.pumpDuty?.flowM3h).toBe(108);
    expect(r.risers).toBe(2);
    expect(r.riser.allCriteriaMet).toBe(true);
    expect(r.riser.pumpDuty).toBeNull();
    expect(r.overallProvenance).toBe('ASSUMED');
    expect(r.appliedAssumptionIds).toEqual(
      expect.arrayContaining([
        'OCCUPANT_AREA_10M2',
        'DEMAND_LPCD_150',
        'USAGE_HOURS_10',
        'PEAK_MINUTE_FACTOR_3',
        'ZONE_MAX_STATIC_4BAR',
        'TRANSFER_ROUTE_VERTICAL',
      ]),
    );
    expect(r.traces.map((t) => t.ruleId).slice(0, 3)).toEqual(['ENG-501', 'ENG-502', 'ENG-503']);
    expect(r.traces.every((t) => t.provenance !== 'VERIFIED')).toBe(true);
  });

  it('penghuni yang disebut dipakai langsung; gedung kecil satu riser, satu zona', () => {
    const r = computeBuildingWater({ floors: 6, occupants: 120 });
    expect(r.occupantsEstimated).toBe(false);
    expect(r.appliedAssumptionIds).not.toContain('OCCUPANT_AREA_10M2');
    expect(r.zoning.zones).toBe(1);
    expect(r.risers).toBe(1);
    expect(r.transfer.recommendedSize).toBe('1"');
  });

  it('tanpa penghuni dan luas → minta data, tidak menebak', () => {
    expect(() => computeBuildingWater({ floors: 12 })).toThrow(BuildingOccupancyUnknownError);
  });

  it('penjelasan dwibahasa dengan angka yang sama', () => {
    const id = computeBuildingWater({ floors: 12, floorAreaM2: 3000 });
    const en = computeBuildingWater({ floors: 12, floorAreaM2: 3000 }, 'en');
    expect(id.traces[1]!.explanation).toContain('Kebutuhan harian 540 m³');
    expect(en.traces[1]!.explanation).toContain('Daily demand 540 m³');
  });
});

describe('ekstraksi dan pertanyaan gedung bertingkat', () => {
  it('"100 x 30" adalah luas per lantai; penghuni dari "600 penghuni"', () => {
    const owner = extractTechnicalContext(
      'oi gw mau bikin gedung dengan luas 100 x 30 12 lantai, apa aja yang dibutuhin',
      CASE,
    );
    expect(owner).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'floor_area', value: 3000, unit: 'm²' }),
        expect.objectContaining({ key: 'building_floors', value: 12 }),
      ]),
    );
    const apartment = extractTechnicalContext('apartemen 15 lantai, 600 penghuni, 1200 m2', CASE);
    expect(apartment).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'floor_area', value: 1200 }),
        expect.objectContaining({ key: 'number_of_occupants', value: 600 }),
      ]),
    );
  });

  it('luas lantai menggantikan pertanyaan jumlah penghuni', () => {
    const profile = caseProfile(CASE);
    const ask = (known: string[]) =>
      resolveMissingParameters({ profile, known: new Set(known), assumed: new Set() }).map(
        (m) => m.key,
      );
    expect(ask(['building_floors'])).toContain('number_of_occupants');
    expect(ask(['building_floors', 'floor_area'])).not.toContain('number_of_occupants');
  });
});

describe('pipa tiap lantai dari titik air per lantai', () => {
  it('6 kamar mandi + 4 wastafel per lantai → titik, cabang, induk lantai', () => {
    const r = computeBuildingWater({
      floors: 12,
      floorAreaM2: 3000,
      bathroomsPerFloor: 6,
      basinsPerFloor: 4,
    });
    expect(r.floorBranch).toMatchObject({
      outletsPerFloor: 10,
      loadUnitsPerFloor: 16,
      branchesPerFloor: 3,
      fixtureConnectionSize: '1/2"',
      flowPerFloorLs: 3.75,
      headerLengthM: 54.8,
    });
    expect(r.floorBranch!.header.allCriteriaMet).toBe(true);
    expect(r.traceGroups.floor).toBe(
      r.traces.length -
        r.traceGroups.demand -
        r.traceGroups.transfer -
        r.traceGroups.split -
        r.traceGroups.riser,
    );
    expect(r.appliedAssumptionIds).not.toContain('FLOOR_HEADER_20M');
  });

  it('tanpa titik air per lantai → pipa lantai tidak dihitung, bukan ditebak', () => {
    const r = computeBuildingWater({ floors: 12, floorAreaM2: 3000 });
    expect(r.floorBranch).toBeNull();
    expect(r.traceGroups.floor).toBe(0);
  });

  it('"6 toilet per lantai", "tiap lantai 4 wastafel"', () => {
    const facts = extractTechnicalContext(
      'gedung 12 lantai, 6 toilet per lantai, tiap lantai 4 wastafel',
      CASE,
    );
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'bathrooms_per_floor', value: 6 }),
        expect.objectContaining({ key: 'basins_per_floor', value: 4 }),
        expect.objectContaining({ key: 'building_floors', value: 12 }),
      ]),
    );
  });

  it('kamar mandi dan wastafel per lantai ikut ditanya', () => {
    const asked = resolveMissingParameters({
      profile: caseProfile(CASE),
      known: new Set(['building_floors', 'floor_area']),
      assumed: new Set(),
    }).map((m) => m.key);
    expect(asked.slice(0, 2)).toEqual(['bathrooms_per_floor', 'basins_per_floor']);
  });
});

describe('asumsi yang diganti pengguna', () => {
  it('kebutuhan 200 l/orang dan tangki bawah 2 hari: hasil berubah, tidak lagi tercatat sebagai asumsi', () => {
    const base = computeBuildingWater({ floors: 12, floorAreaM2: 3000 });
    const own = computeBuildingWater({ floors: 12, floorAreaM2: 3000 }, 'id', {
      DEMAND_LPCD_150: 200,
      GROUND_TANK_1_DAY: 2,
    });
    expect(own.demand.dailyM3).toBe(720);
    expect(own.tanks.groundTankM3).toBe(1440);
    expect(own.demand.dailyM3).toBeGreaterThan(base.demand.dailyM3);
    expect(own.appliedAssumptionIds).not.toContain('DEMAND_LPCD_150');
    expect(own.appliedAssumptionIds).not.toContain('GROUND_TANK_1_DAY');
    expect(base.appliedAssumptionIds).toContain('DEMAND_LPCD_150');
  });

  it('batas kecepatan pipa ikut sampai ke perhitungan pipa di dalamnya', () => {
    const own = computeBuildingWater({ floors: 12, floorAreaM2: 3000 }, 'id', {
      VELOCITY_MAX_PLASTIC: 1.5,
    });
    expect(own.appliedAssumptionIds).not.toContain('VELOCITY_MAX_PLASTIC');
    expect(own.transfer.velocityMs).toBeLessThanOrEqual(1.5);
  });
});
