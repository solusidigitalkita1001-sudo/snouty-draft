/** P26-07 — event pasar dari konsultasi: tanpa identitas, provinsi dari IP, skala dari aturan prospek. */
import { describe, expect, it } from 'vitest';
import { chatMarketEvent, type ConsultationFacts } from './chat-event.js';
import { placeOf, provinceOf } from './region.js';
import { mapDemand } from './aggregate.js';

const FACTS: ConsultationFacts = {
  buildingType: 'residential',
  floors: 2,
  outletCount: 9,
  installationType: 'clean_water',
  caseId: null,
  products: [
    { family: 'PVC AW', size: '1"' },
    { family: 'PVC AW', size: '1"' },
    { family: 'PVC AW', size: '1/2"' },
    { family: null, size: '1"' },
  ],
  quotationIntent: true,
};

describe('chatMarketEvent (P26-07)', () => {
  it('fakta konsultasi → event: hari, skala, jenis instalasi, minat produk unik', () => {
    const event = chatMarketEvent({
      id: 'E1',
      at: '2026-10-21T09:30:00.000Z',
      region: 'Jawa Barat',
      trigger: 'solution',
      facts: FACTS,
    });
    expect(event).toEqual({
      id: 'E1',
      source: 'chat',
      occurredOn: '2026-10-21',
      region: 'Jawa Barat',
      city: null,
      lat: null,
      lng: null,
      buildingType: 'residential',
      projectScale: 'kecil',
      installationType: 'air_bersih',
      outletCount: 9,
      floors: 2,
      productInterest: ['PVC AW|1"', 'PVC AW|1/2"'],
      quotationIntent: true,
      reachedSolution: true,
      routedToTechnical: false,
    });
  });

  it('kasus kawasan = skala besar; serah ke tim teknis = sinyal cakupan', () => {
    const event = chatMarketEvent({
      id: 'E2',
      at: '2026-10-21T00:00:00Z',
      region: null,
      trigger: 'technical',
      facts: { ...FACTS, buildingType: null, caseId: 'sewerage', installationType: 'drainage' },
    });
    expect(event).toMatchObject({
      buildingType: 'sewerage',
      projectScale: 'besar',
      installationType: 'pembuangan',
      reachedSolution: false,
      routedToTechnical: true,
    });
  });

  it('bentuk event tidak punya tempat untuk identitas atau teks', () => {
    const event = chatMarketEvent({
      id: 'E3',
      at: '2026-10-21T00:00:00Z',
      region: null,
      trigger: 'solution',
      facts: FACTS,
    });
    for (const key of ['userId', 'guestSessionId', 'conversationId', 'ip', 'text', 'email']) {
      expect(Object.keys(event)).not.toContain(key);
    }
  });
});

describe('provinsi dari catatan geolokasi (OQ-77)', () => {
  it('Indonesia → nama provinsi resmi; luar negeri atau kosong → tanpa wilayah', () => {
    const id = (en: string) => ({ country: { iso_code: 'ID' }, subdivisions: [{ names: { en } }] });
    expect(provinceOf(id('West Java'))).toBe('Jawa Barat');
    expect(provinceOf(id('Jakarta'))).toBe('DKI Jakarta');
    expect(provinceOf(id('Provinsi Baru'))).toBe('Provinsi Baru');
    expect(
      provinceOf({ country: { iso_code: 'US' }, subdivisions: [{ names: { en: 'California' } }] }),
    ).toBeNull();
    expect(provinceOf(null)).toBeNull();
    expect(provinceOf({ country: { iso_code: 'ID' } })).toBeNull();
  });
});

describe('tempat dari catatan geolokasi untuk peta (P26-12)', () => {
  const record = {
    country: { iso_code: 'ID' },
    subdivisions: [{ names: { en: 'West Java' } }],
    city: { names: { en: 'Bandung' } },
    location: { latitude: -6.9147222, longitude: 107.6097222 },
  };

  it('koordinat dibulatkan 0,1° — setingkat kota, bukan alamat', () => {
    expect(placeOf(record)).toEqual({
      province: 'Jawa Barat',
      city: 'Bandung',
      lat: -6.9,
      lng: 107.6,
    });
  });

  it('luar Indonesia: tanpa tempat sama sekali', () => {
    expect(placeOf({ country: { iso_code: 'SG' }, city: { names: { en: 'Singapore' } } })).toEqual({
      province: null,
      city: null,
      lat: null,
      lng: null,
    });
  });

  it('provinsi tanpa kota tetap terpakai untuk zona', () => {
    expect(
      placeOf({ country: { iso_code: 'ID' }, subdivisions: [{ names: { en: 'Bali' } }] }),
    ).toEqual({ province: 'Bali', city: null, lat: null, lng: null });
  });
});

describe('agregat peta (P26-12)', () => {
  const event = (over: Partial<Parameters<typeof mapDemand>[0][number]>) =>
    ({
      id: 'x',
      source: 'chat',
      occurredOn: '2026-10-21',
      region: 'Jawa Barat',
      city: 'Bandung',
      lat: -6.9,
      lng: 107.6,
      buildingType: null,
      projectScale: null,
      installationType: null,
      outletCount: null,
      floors: null,
      productInterest: [],
      quotationIntent: false,
      reachedSolution: true,
      routedToTechnical: false,
      ...over,
    }) as Parameters<typeof mapDemand>[0][number];

  it('provinsi dan titik di bawah lima tidak digambar, tetapi dihitung', () => {
    const events = [
      ...Array.from({ length: 6 }, () => event({})),
      ...Array.from({ length: 3 }, () =>
        event({ region: 'Bali', city: 'Denpasar', lat: -8.7, lng: 115.2 }),
      ),
      event({ region: null, city: null, lat: null, lng: null }),
    ];
    const map = mapDemand(events);
    expect(map.provinces).toEqual([{ name: 'Jawa Barat', count: 6 }]);
    expect(map.points).toEqual([
      { city: 'Bandung', province: 'Jawa Barat', lat: -6.9, lng: 107.6, count: 6 },
    ]);
    expect(map).toMatchObject({ withoutRegion: 1, suppressedPoints: 3 });
  });

  it('event tanpa kota tetap mengisi zona provinsinya', () => {
    const map = mapDemand(
      Array.from({ length: 5 }, () => event({ city: null, lat: null, lng: null })),
    );
    expect(map.provinces).toEqual([{ name: 'Jawa Barat', count: 5 }]);
    expect(map.points).toEqual([]);
  });
});
