import { describe, expect, it } from 'vitest';
import { afterAuthHref, gateHref, parseResume } from './resume-link';

const ID = '01JBC0NV0000000000000000AB';

describe('resume-link (P8-09)', () => {
  it('gateHref membawa percakapan dan aksinya ke layar daftar/masuk', () => {
    expect(gateHref('register', ID, 'save')).toBe(`/register?resume=${ID}&then=save`);
    expect(gateHref('login', ID, 'save')).toBe(`/login?resume=${ID}&then=save`);
  });

  it('parseResume hanya menerima ULID dan aksi yang dikenal', () => {
    expect(parseResume(`?resume=${ID}&then=save`)).toEqual({ conversationId: ID, then: 'save' });
    expect(parseResume(`?c=${ID}`)).toEqual({ conversationId: ID, then: null });
    expect(parseResume(`?c=${ID}&then=delete`)).toEqual({ conversationId: ID, then: null });
    expect(parseResume('?resume=https://evil.example')).toBeNull();
    expect(parseResume('')).toBeNull();
  });

  it('afterAuthHref: kembali ke percakapan yang sama, aksi ikut bila percakapannya cocok', () => {
    expect(afterAuthHref(`?resume=${ID}&then=save`, ID)).toBe(`/consultation?c=${ID}&then=save`);
    // Server memindahkan percakapan lain: buka itu, tetapi aksinya tidak diteruskan.
    const other = '01JBC0NV0000000000000000CD';
    expect(afterAuthHref(`?resume=${ID}&then=save`, other)).toBe(`/consultation?c=${other}`);
    expect(afterAuthHref('', null)).toBe('/consultation');
    expect(afterAuthHref(`?resume=${ID}`, null)).toBe(`/consultation?c=${ID}`);
  });
});
