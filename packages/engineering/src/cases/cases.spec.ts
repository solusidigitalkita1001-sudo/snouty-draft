/**
 * Fase 2 — profil kasus, klasifikasi, ekstraksi konteks teknis, pemilih parameter kurang.
 * Skenario dari brief §39 (A–G) dipakai sebagai kalimat uji.
 */
import { describe, expect, it } from 'vitest';
import { isParameterKey } from '../parameters/registry.js';
import { extractTechnicalContext } from './extractor.js';
import { caseReadiness, resolveMissingParameters } from './missing.js';
import { CASE_PROFILES, activeParameters, caseProfile } from './profiles.js';

describe('CaseProfileRegistry', () => {
  it('ID unik, parameter terdaftar dan tidak ganda, setiap profil punya keluaran', () => {
    const ids = CASE_PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of CASE_PROFILES) {
      const params = activeParameters(p);
      expect(new Set(params).size).toBe(params.length);
      for (const key of params) expect(isParameterKey(key)).toBe(true);
      expect(p.outputs.length).toBeGreaterThan(0);
      expect(p.critical.length).toBeGreaterThanOrEqual(2);
    }
    expect(caseProfile('irrigation').calculatorStatus).toBe('available');
    expect(caseProfile('multistorey_building_water').calculatorStatus).toBe('pending');
  });
});

// Klasifikasi kasus dari kalimat pindah ke data (data/understanding/use-case.json, P16-14) dan
// diukur golden set pemahaman; paket ini tidak lagi membaca bahasa.

describe('TechnicalContextExtractor', () => {
  it('skenario A irigasi: sungai 150 m, 4 m lebih rendah, 2 hektar sprinkler', () => {
    const facts = extractTechnicalContext(
      'Irigasi 2 hektar pakai sprinkler, sumbernya sungai 150 m dari lahan, sungainya 4 m lebih rendah',
      'irrigation',
    );
    const by = Object.fromEntries(facts.map((f) => [f.key, f.value]));
    expect(by).toMatchObject({
      total_area: 2,
      irrigation_method: 'Sprinkler',
      source_type: 'Sungai / saluran',
      route_length: 150,
      static_head: 4,
      fluid_type: 'Air irigasi',
    });
  });

  it('debit dikonversi ke l/s; km ke m; m² ke ha; sumur tidak tertukar dengan panjang', () => {
    const by = (s: string, c: Parameters<typeof extractTechnicalContext>[1] = null) =>
      Object.fromEntries(extractTechnicalContext(s, c).map((f) => [f.key, f.value]));
    expect(by('debit 36 m3/jam sejauh 1,2 km')).toMatchObject({
      design_flow: 10,
      route_length: 1200,
    });
    expect(by('60 liter/menit')).toMatchObject({ design_flow: 1 });
    expect(by('drainase hujan tangkapan 5000 m2, hujan 100 mm/jam', 'stormwater')).toMatchObject({
      catchment_area: 0.5,
      rainfall_intensity: 100,
      fluid_type: 'Air hujan',
    });
    expect(by('sumur bor kedalaman 60 m ke tandon jarak 30 m')).toMatchObject({
      well_depth: 60,
      route_length: 30,
      source_type: 'Sumur',
    });
    expect(by('gorong-gorong, lebar jalan 6 m, dilewati truk', 'culvert')).toMatchObject({
      road_width: 6,
      traffic_load: 'Truk / berat',
    });
  });

  it('kolam: "4 x 4 meter" jadi panjang × lebar (bukan panjang jalur); kedalaman, jumlah kolam, jam', () => {
    const by = (s: string) =>
      Object.fromEntries(extractTechnicalContext(s, 'fish_pond').map((f) => [f.key, f.value]));
    expect(by('tambak lele 4 x 4 meter')).toMatchObject({ pond_length: 4, pond_width: 4 });
    expect(by('tambak lele 4 x 4 meter')).not.toHaveProperty('route_length');
    expect(by('3 kolam 5x3 m dalam 80 cm, diisi 2 jam dari sumur 15 m')).toMatchObject({
      number_of_ponds: 3,
      pond_length: 5,
      pond_width: 3,
      pond_depth: 0.8,
      fill_time_hours: 2,
      source_type: 'Sumur',
      route_length: 15,
    });
  });

  it('bangunan: lantai, kamar mandi, unit, diameter, bahan, pompa', () => {
    const by = Object.fromEntries(
      extractTechnicalContext(
        'rumah 2 lantai 3 kamar mandi 1 dapur, pipa pvc 1 1/2" dengan pompa',
      ).map((f) => [f.key, f.value]),
    );
    expect(by).toMatchObject({
      building_floors: 2,
      bathrooms: 3,
      kitchens: 1,
      nominal_diameter: '1 1/2"',
      material: 'PVC (uPVC)',
      pump_required: true,
    });
  });
});

describe('MissingParameterResolver', () => {
  it('transfer pompa tanpa data: ≤ 4 pertanyaan, kritis dulu, bahasa pengguna, menyebut keluaran yang dibuka', () => {
    const profile = caseProfile('pump_transfer');
    const missing = resolveMissingParameters({ profile, known: new Set(), assumed: new Set() });
    expect(missing.length).toBeLessThanOrEqual(4);
    expect(missing.map((m) => m.importance)).toEqual([
      'critical',
      'critical',
      'critical',
      'critical',
    ]);
    expect(missing[0]!.question).not.toMatch(/static head|Q design/i);
    expect(missing.some((m) => m.unlocks.includes('pump_sizing'))).toBe(true);
  });

  it('yang sudah diketahui/diasumsikan tidak ditanya lagi; kesiapan per keluaran ikut profil', () => {
    const profile = caseProfile('irrigation');
    const known = new Set(['source_type', 'total_area', 'irrigation_method', 'source_elevation']);
    const assumed = new Set(['route_length', 'design_flow', 'material']);
    const missing = resolveMissingParameters({ profile, known, assumed });
    expect(missing.map((m) => m.key)).not.toContain('route_length');
    expect(missing.map((m) => m.key)).not.toContain('total_area');
    const readiness = caseReadiness({ profile, known, assumed });
    expect(readiness.readiness.pump_sizing).toBe('partial'); // wajib ada, yang memperbaiki belum
    expect(Object.keys(readiness.readiness)).toEqual([...profile.outputs]);
  });
});
