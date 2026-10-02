/**
 * P11-03a — verifikasi tanda tangan webhook: menolak yang hilang, kedaluwarsa, dan salah;
 * menandatangani badan MENTAH; dan timestamp ikut ditandatangani (anti-replay).
 */
import { describe, expect, it } from 'vitest';
import { sign, SIGNATURE_MAX_AGE_SECONDS, verifyWebhookSignature } from './webhook-signature.js';

const SECRET = 'rahasia-webhook-uji';
const NOW = 1_760_000_000;
const BODY = '{"subject":"Permintaan penawaran","from":"budi@contoh.co.id"}';

function valid(over: Partial<Parameters<typeof verifyWebhookSignature>[0]> = {}) {
  const timestampHeader = String(NOW);
  return verifyWebhookSignature({
    rawBody: BODY,
    timestampHeader,
    signatureHeader: sign(BODY, timestampHeader, SECRET),
    secret: SECRET,
    nowSeconds: NOW,
    ...over,
  });
}

describe('verifyWebhookSignature', () => {
  it('menerima tanda tangan yang sah', () => {
    expect(valid()).toEqual({ ok: true });
  });

  it('menolak tanpa header tanda tangan', () => {
    expect(valid({ signatureHeader: undefined })).toEqual({ ok: false, reason: 'missing' });
  });

  it('menolak tanpa header timestamp', () => {
    expect(valid({ timestampHeader: undefined })).toEqual({ ok: false, reason: 'missing' });
  });

  it('menolak timestamp yang bukan angka', () => {
    expect(valid({ timestampHeader: 'kemarin' })).toEqual({ ok: false, reason: 'missing' });
  });

  it('menolak tanda tangan kedaluwarsa (replay)', () => {
    const old = String(NOW - SIGNATURE_MAX_AGE_SECONDS - 1);
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        timestampHeader: old,
        signatureHeader: sign(BODY, old, SECRET),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toEqual({ ok: false, reason: 'stale' });
  });

  it('menerima jam pengirim yang sedikit di depan', () => {
    const ahead = String(NOW + 30);
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        timestampHeader: ahead,
        signatureHeader: sign(BODY, ahead, SECRET),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toEqual({ ok: true });
  });

  it('menolak tanda tangan dari rahasia lain', () => {
    const timestampHeader = String(NOW);
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        timestampHeader,
        signatureHeader: sign(BODY, timestampHeader, 'rahasia-salah'),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('menolak badan yang diubah setelah ditandatangani', () => {
    const timestampHeader = String(NOW);
    expect(
      verifyWebhookSignature({
        rawBody: '{"subject":"Diubah"}',
        timestampHeader,
        signatureHeader: sign(BODY, timestampHeader, SECRET),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('timestamp ikut ditandatangani — memakai ulang tanda tangan dengan timestamp baru gagal', () => {
    // Tanpa ini, penyerang bisa menyalin tanda tangan lama dan hanya menyegarkan
    // timestamp-nya untuk lolos jendela waktu.
    const oldTimestamp = String(NOW - 10);
    const signature = sign(BODY, oldTimestamp, SECRET);
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        timestampHeader: String(NOW),
        signatureHeader: signature,
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('menolak tanda tangan dengan panjang berbeda tanpa melempar', () => {
    expect(valid({ signatureHeader: 'pendek' })).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('badan yang di-parse lalu di-stringify ulang TIDAK cocok — tanda tangan atas badan mentah', () => {
    // Ini jebakan yang biasa: urutan kunci dan spasi berubah, tanda tangan sah ditolak,
    // lalu orang "memperbaikinya" dengan melemahkan verifikasi.
    const reserialized = JSON.stringify(JSON.parse(BODY) as Record<string, unknown>);
    const timestampHeader = String(NOW);
    const result = verifyWebhookSignature({
      rawBody: reserialized === BODY ? `${reserialized} ` : reserialized,
      timestampHeader,
      signatureHeader: sign(BODY, timestampHeader, SECRET),
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(result.ok).toBe(false);
  });
});
