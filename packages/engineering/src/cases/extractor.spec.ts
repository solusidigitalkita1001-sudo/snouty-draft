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

  it('reads pond sides stated one by one, and leaves a stated route length alone', () => {
    expect(
      facts('panjang 4 meter lebar 3 meter dalam air 1 meter, 2 kolam', 'fish_pond'),
    ).toMatchObject({
      pond_length: 4,
      pond_width: 3,
      pond_depth: 1,
      number_of_ponds: 2,
    });
    // "panjang jalur" tetap panjang jalur: hanya kata "kolam" boleh berdiri di antara penanda
    // dan angkanya.
    expect(facts('kolam 5 x 8 m, panjang jalur 30 meter', 'fish_pond')).toMatchObject({
      pond_length: 5,
      pond_width: 8,
      route_length: 30,
    });
    expect(facts('a pond 4 m wide, lebar kolam tidak disebut', 'fish_pond')).toMatchObject({
      pond_width: 4,
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

describe('extractTechnicalContext — temuan smoke 2026-10-16', () => {
  it('"tinggi lantai 4 m" bukan panjang jalur: menjadi tinggi bangunan 8 × 4 m', () => {
    const f = facts(
      'gedung kantor 8 lantai, 4 toilet per lantai, tinggi lantai 4 m, air dari pdam ke tangki bawah',
      'multistorey_building_water',
    );
    expect(f).toMatchObject({ building_floors: 8, building_height: 32 });
    expect(f).not.toHaveProperty('route_length');
  });

  it('"tandon di bukit 40 meter" adalah beda tinggi, bukan panjang jalur', () => {
    const f = facts(
      'transfer air dari sungai ke tandon di bukit 40 meter, jarak 500 m, debit 5 liter per detik',
      'pump_transfer',
    );
    expect(f).toMatchObject({ static_head: 40, route_length: 500, design_flow: 5 });
  });
});

describe('extractTechnicalContext — audit PDAM 2026-10-16: angka pengguna dipertahankan', () => {
  it('"1.500 meter" adalah 1 500 m, bukan 1,5 m; "1,5 km" adalah 1 500 m; "2.000 sambungan" 2 000', () => {
    expect(
      facts('jaringan distribusi pdam, pipa induk 1.500 meter', 'water_supply_network'),
    ).toMatchObject({
      route_length: 1500,
    });
    expect(facts('pipa transmisi 1,5 km', 'water_supply_network')).toMatchObject({
      route_length: 1500,
    });
    expect(facts('spam untuk 2.000 sambungan rumah', 'water_supply_network')).toMatchObject({
      number_of_connections: 2000,
    });
    expect(facts('beda tinggi 12,5 meter', 'pump_transfer')).toMatchObject({ static_head: 12.5 });
    expect(facts('debit 2.5 liter per detik', 'pump_transfer')).toMatchObject({ design_flow: 2.5 });
  });
});

describe('extractTechnicalContext — jaringan PDAM: tekanan sumber dan jumlah cabang', () => {
  it('"tekanan pdam 1,5 bar" adalah tekanan sumber; "butuh 2 bar di ujung" tekanan yang dibutuhkan; "bercabang 4"', () => {
    const f = facts(
      'spam pdam 500 sambungan rumah, pipa induk 1.500 meter, beda tinggi 20 m, jalurnya bercabang 4, tekanan pdam 1,5 bar, pakai hdpe',
      'water_supply_network',
    );
    expect(f).toMatchObject({
      number_of_connections: 500,
      route_length: 1500,
      static_head: 20,
      number_of_branches: 4,
      source_pressure: 1.5,
    });
    expect(f).not.toHaveProperty('required_pressure');
    expect(facts('di ujung butuh 2 bar, 4 cabang', 'water_supply_network')).toMatchObject({
      required_pressure: 2,
      number_of_branches: 4,
    });
    expect(facts('mains pressure 3 bar, 6 branches', 'water_supply_network')).toMatchObject({
      source_pressure: 3,
      number_of_branches: 6,
    });
  });
});

describe('extractTechnicalContext — audit 2026-10-19: kolam sebagai tujuan, bukan sumber', () => {
  const source = (text: string) =>
    extractTechnicalContext(text).find((f) => f.key === 'source_type')?.value;

  it('"kolam lele 10 kolam" tidak mencatat sumber air', () => {
    expect(source('kolam lele 10 kolam, butuh pipa apa?')).toBeUndefined();
    expect(source('10 fish ponds, which pipe?')).toBeUndefined();
  });

  it('kolam yang disebut sebagai asal air tetap sumber', () => {
    expect(source('air dari kolam ke sawah 200 m')).toBe('Embung / kolam');
    expect(source('sumber airnya embung, jarak 300 m')).toBe('Embung / kolam');
    expect(source('water from a pond to the field')).toBe('Embung / kolam');
  });
});

describe('extractTechnicalContext — simulasi 2026-10-19: tinggi tandon tujuan', () => {
  const elevation = (text: string) =>
    extractTechnicalContext(text, 'well_distribution').find((f) => f.key === 'tank_elevation')
      ?.value;

  it('"tandon atas rumah setinggi 7 meter" dan "tinggi toren 6 m" terbaca', () => {
    expect(
      elevation('sumur bor 40 meter ke tandon atas rumah setinggi 7 meter, jarak 15 meter'),
    ).toBe(7);
    expect(elevation('tinggi toren 6 m dari tanah')).toBe(6);
    expect(elevation('pump to a tank at 12 m height')).toBe(12);
  });

  it('jarak dan beda tinggi bukan tinggi tandon', () => {
    expect(elevation('sumur bor 40 meter ke tandon atas rumah, jarak 15 meter')).toBeUndefined();
    expect(
      elevation('dari tandon bawah ke tandon atas, jarak 100 meter, beda tinggi 15 meter'),
    ).toBeUndefined();
  });
});
