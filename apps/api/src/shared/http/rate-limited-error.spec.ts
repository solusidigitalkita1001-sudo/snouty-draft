/**
 * Pemilik 2026-10-12: tamu ditolak "Permintaan terlalu sering. Coba lagi sebentar." padahal harus
 * menunggu ±58 menit. Pesan menyebut lama menunggu; tamu menerima batas akun terdaftar.
 */
import { describe, expect, it } from 'vitest';
import { limitFor } from '../../modules/policy/rate-limits.js';
import { RateLimitedError, waitMinutes } from './api-errors.js';

describe('RateLimitedError', () => {
  it('menyebut lama menunggu dalam menit (dibulatkan ke atas)', () => {
    expect(new RateLimitedError(3484).message).toBe(
      'Batas permintaan tercapai. Coba lagi dalam ±59 menit.',
    );
    expect(waitMinutes(5)).toBe(1);
  });

  it('membawa keterangan tambahan untuk klien', () => {
    const registered = limitFor('registered', 'messages_per_hour')!;
    const error = new RateLimitedError(3484, { tier: 'guest', registeredMax: registered.max });
    expect(error.details).toEqual({ retryAfterSec: 3484, tier: 'guest', registeredMax: 60 });
  });
});
