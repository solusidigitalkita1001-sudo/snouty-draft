/**
 * P15-05 — laporan yang tersimpan sebelum laporan dua bahasa tidak punya `locale`; mereka
 * semua lahir dalam bahasa Indonesia dan harus tetap tercetak sebagai Indonesia.
 */
import { describe, expect, it } from 'vitest';
import { storedReportPayload } from './report-payload.js';

const LEGACY = {
  reportNumber: 'SNTY-2026-10-0001',
  identity: {
    customerName: 'Tamu',
    projectLocation: '—',
    consultationDate: '2026-10-02',
    installationType: 'Air bersih',
  },
  headline: 'Judul',
  body: 'Isi',
  requirements: [],
  systemLines: [],
  assumptions: [],
  bom: [],
  basis: [],
  pricing: { enabled: false, taxRatePercent: 11, subtotal: 0, taxAmount: 0, total: 0 },
  catalogVersionLabel: 'dev-0.2',
  overallProvenance: 'ASSUMED',
};

describe('storedReportPayload', () => {
  it("payload lama tanpa locale dibaca sebagai 'id', isi lainnya utuh", () => {
    expect(storedReportPayload(LEGACY)).toEqual({ ...LEGACY, locale: 'id' });
  });

  it('locale yang tersimpan dipertahankan', () => {
    expect(storedReportPayload({ ...LEGACY, locale: 'en' }).locale).toBe('en');
  });

  it('locale yang tidak dikenal jatuh ke baku, bukan menggagalkan cetak', () => {
    expect(storedReportPayload({ ...LEGACY, locale: 'jv' }).locale).toBe('id');
  });
});
