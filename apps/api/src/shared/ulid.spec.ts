import { describe, expect, it } from 'vitest';
import { ulid } from './ulid.js';

describe('ulid', () => {
  it('26 karakter Crockford base32', () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('monoton dalam milidetik yang sama — urutan pembuatan = urutan id (laporan 0010)', () => {
    const t = 1_760_000_000_000;
    const ids = Array.from({ length: 50 }, () => ulid(t));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('milidetik berikutnya tetap lebih besar', () => {
    const t = 1_760_000_000_000;
    const a = ulid(t);
    const b = ulid(t + 1);
    expect(b > a).toBe(true);
  });
});
