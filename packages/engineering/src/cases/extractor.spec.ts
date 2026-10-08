import { describe, expect, it } from 'vitest';
import type { CaseId } from './profiles.js';
import { extractTechnicalContext } from './extractor.js';

const facts = (message: string, caseId: CaseId | null = null) =>
  Object.fromEntries(extractTechnicalContext(message, caseId).map((f) => [f.key, f.value]));

describe('extractTechnicalContext — English', () => {
  it('reads flow, distance and a destination-higher head from a transfer sentence', () => {
    const f = facts(
      'transfer water from a well to a tank, 5 liters per second, 800 m, 12 m higher',
      'pump_transfer',
    );
    expect(f).toMatchObject({ design_flow: 5, route_length: 800, static_head: 12 });
  });

  it('reads a river that is lower than the destination as a positive head', () => {
    expect(facts('the river is 4 meters lower, 150 metres away', 'pump_transfer')).toMatchObject({
      static_head: 4,
      route_length: 150,
      source_type: 'Sungai / saluran',
    });
  });

  it('reads pond dimensions and depth', () => {
    expect(facts('fish pond 4 x 4 m, 1.2 m deep', 'fish_pond')).toMatchObject({
      pond_length: 4,
      pond_width: 4,
      pond_depth: 1.2,
    });
    expect(facts('a pond 4 by 3 meters', 'fish_pond')).toMatchObject({
      pond_length: 4,
      pond_width: 3,
    });
  });

  it('reads catchment area and slope for stormwater', () => {
    expect(
      facts('rainwater drainage for a 2 hectare parking lot, slope 1%', 'stormwater'),
    ).toMatchObject({ catchment_area: 2, slope: 1, fluid_type: 'Air hujan' });
  });

  it('Indonesian "jalan desa lebar 6 meter": the width belongs to the road, not the route length', () => {
    const out = facts('mau pasang gorong-gorong lewat jalan desa lebar 6 meter', 'culvert');
    expect(out).toMatchObject({ road_width: 6 });
    expect(out).not.toHaveProperty('route_length');
  });

  it('reads road width and traffic for a culvert', () => {
    expect(facts('culvert under a 6 m road for trucks', 'culvert')).toMatchObject({
      road_width: 6,
      traffic_load: 'Truk / berat',
    });
  });

  it('reads connections and main line length for a housing estate', () => {
    expect(
      facts('housing estate with 40 houses, 300 m main line', 'residential_cluster'),
    ).toMatchObject({ number_of_connections: 40, route_length: 300 });
  });

  it('reads well depth, floors and flow in other units', () => {
    expect(facts('a 60 m deep borehole, 18 m3/h', 'well_distribution')).toMatchObject({
      well_depth: 60,
      design_flow: 5,
    });
    expect(facts('a 5 storey building with 10 bathrooms')).toMatchObject({
      building_floors: 5,
      bathrooms: 10,
    });
  });

  it('does not read "without a pump" as a pump request', () => {
    expect(facts('gravity only, without a pump')).toMatchObject({ pump_required: false });
  });
});

describe('extractTechnicalContext — Indonesian unchanged', () => {
  it('still reads the original phrasing', () => {
    expect(facts('sungai 150 m, 4 m lebih rendah, debit 5 liter per detik')).toMatchObject({
      static_head: 4,
      route_length: 150,
      design_flow: 5,
      source_type: 'Sungai / saluran',
    });
    expect(facts('kolam 4 x 4 m, kedalaman 1,2 m', 'fish_pond')).toMatchObject({
      pond_length: 4,
      pond_width: 4,
      pond_depth: 1.2,
    });
    expect(facts('perumahan 40 unit, jalur 300 m')).toMatchObject({
      number_of_connections: 40,
      route_length: 300,
    });
  });
});

describe('extractTechnicalContext — beda tinggi (laporan pemilik 2026-10-08)', () => {
  it('penanda netral "beda tinggi 15 m" dari sumur ke tandon → +15 (air dinaikkan), bukan −15', () => {
    expect(
      facts('transfer air dari sumur bor ke tandon jarak 300 m beda tinggi 15 m', 'pump_transfer'),
    ).toMatchObject({ static_head: 15, route_length: 300 });
  });

  it('"ubah beda tingginya jadi 20 meter" mengubah beda tinggi, bukan panjang jalur', () => {
    const f = facts('ubah beda tingginya jadi 20 meter', 'pump_transfer');
    expect(f).toMatchObject({ static_head: 20 });
    expect(f).not.toHaveProperty('route_length');
  });

  it('"lebih rendah/lebih tinggi" tetap menentukan arah dari subjek kalimat', () => {
    expect(facts('sungainya 4 m lebih rendah', 'pump_transfer')).toMatchObject({ static_head: 4 });
    expect(facts('sumbernya 6 m lebih tinggi', 'pump_transfer')).toMatchObject({ static_head: -6 });
  });
});
