/**
 * P4-07a — skema ekstraksi: optional bukan nullable, enum tertutup, batas numerik.
 */
import { describe, expect, it } from 'vitest';
import { ExtractionSchema, IntentSchema } from './extraction-schema.js';

describe('ExtractionSchema', () => {
  it('menerima objek kosong — tidak ada yang disebut', () => {
    expect(ExtractionSchema.parse({})).toEqual({});
  });

  it('field yang tidak disebut tetap undefined, bukan null', () => {
    const parsed = ExtractionSchema.parse({ building: { floors: 2 } });
    expect(parsed.building?.floors).toBe(2);
    expect(parsed.fixtures).toBeUndefined();
  });

  it('menerima 0 sebagai pernyataan ketiadaan yang eksplisit', () => {
    const parsed = ExtractionSchema.parse({ fixtures: { kitchens: 0 } });
    expect(parsed.fixtures?.kitchens).toBe(0);
  });

  it('menolak null (nullable akan membuat sistem menanyakan ulang)', () => {
    expect(() => ExtractionSchema.parse({ building: { floors: null } })).toThrow();
  });

  it('menolak enum di luar daftar', () => {
    expect(() => ExtractionSchema.parse({ water: { source: 'well' } })).toThrow();
  });

  it('menolak lantai di luar batas masuk akal', () => {
    expect(() => ExtractionSchema.parse({ building: { floors: 900 } })).toThrow();
    expect(() => ExtractionSchema.parse({ building: { floors: 0 } })).toThrow();
  });

  it('menolak properti tak dikenal (.strict — keluaran model tak tepercaya)', () => {
    expect(() => ExtractionSchema.parse({ building: { lantai: 2 } })).toThrow();
    expect(() => ExtractionSchema.parse({ extra: true })).toThrow();
  });
});

describe('IntentSchema', () => {
  it('menerima intent dikenal dengan confidence', () => {
    expect(IntentSchema.parse({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 })).toEqual({
      intent: 'PRODUCT_LOOKUP',
      confidence: 0.9,
    });
  });

  it('menolak intent tak dikenal', () => {
    expect(() => IntentSchema.parse({ intent: 'CHITCHAT', confidence: 1 })).toThrow();
  });

  it('menolak confidence di luar 0–1', () => {
    expect(() => IntentSchema.parse({ intent: 'OUT_OF_SCOPE', confidence: 2 })).toThrow();
  });
});
