import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PROSPECT_SIGNAL, signalRowOf } from './prospect-signal.js';

const NOW = new Date('2026-10-21T09:30:00Z');
const USER = '01JUSER000000000000000000A';
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

describe('sinyal prospek 5A (P26-02)', () => {
  it('unduh laporan: rujukan id laporan, presisi hari, pengguna bila masuk', () => {
    const row = signalRowOf(
      PROSPECT_SIGNAL.reportDownload,
      { params: { id: '01JREPORT00000000000000000' }, authUser: { userId: USER } },
      NOW,
    );
    expect(row).toMatchObject({
      kind: 'report_download',
      refId: '01JREPORT00000000000000000',
      userId: USER,
      occurredOn: '2026-10-21',
    });
  });

  it('unduhan tamu tetap dicatat tanpa pengguna — pemiliknya dari percakapan saat dibaca', () => {
    const row = signalRowOf(PROSPECT_SIGNAL.reportDownload, { params: { id: 'R1' } }, NOW);
    expect(row?.userId).toBeNull();
  });

  it('buka produk hanya untuk pengguna terdaftar (OQ-76: tamu tidak dipantau per orang)', () => {
    expect(signalRowOf(PROSPECT_SIGNAL.productView, { params: { id: 'P1' } }, NOW)).toBeNull();
    expect(
      signalRowOf(
        PROSPECT_SIGNAL.productView,
        { params: { id: 'P1' }, authUser: { userId: USER } },
        NOW,
      )?.kind,
    ).toBe('product_view');
  });

  it('token tautan bagikan tidak pernah disimpan mentah — hanya SHA-256-nya', () => {
    const row = signalRowOf(
      PROSPECT_SIGNAL.shareVisit,
      { params: { token: 'rahasia-token' } },
      NOW,
    );
    expect(row?.refId).toBe(sha256('rahasia-token'));
    expect(JSON.stringify(row)).not.toContain('rahasia-token');
  });

  it('kejadian sama di hari sama berkunci sama; hari lain berbeda', () => {
    const req = { params: { id: 'R1' }, authUser: { userId: USER } };
    const a = signalRowOf(PROSPECT_SIGNAL.reportDownload, req, NOW);
    const b = signalRowOf(PROSPECT_SIGNAL.reportDownload, req, new Date('2026-10-21T23:00:00Z'));
    const c = signalRowOf(PROSPECT_SIGNAL.reportDownload, req, new Date('2026-10-22T01:00:00Z'));
    expect(a?.dedupeKey).toBe(b?.dedupeKey);
    expect(a?.dedupeKey).not.toBe(c?.dedupeKey);
  });

  it('parameter kosong atau tidak wajar tidak dicatat', () => {
    expect(signalRowOf(PROSPECT_SIGNAL.reportDownload, { params: {} }, NOW)).toBeNull();
    expect(
      signalRowOf(PROSPECT_SIGNAL.reportDownload, { params: { id: 'x'.repeat(65) } }, NOW),
    ).toBeNull();
  });
});
