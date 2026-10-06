/**
 * ReplyWriter: model merangkai, kode memeriksa. Yang dipaku: angka di luar DATA →
 * fallback; merek lain → fallback; bentuk salah atau model gagal → fallback; dan
 * konteks membawa giliran terakhir supaya balasan nyambung.
 */
import { describe, expect, it } from 'vitest';
import { ReplyWriter, buildReplyContext, passesGuards } from './reply-writer.js';

const ai = (raw: unknown) => ({ writeProse: async () => raw });
const base = {
  intent: 'OUT_OF_SCOPE' as const,
  userMessage: 'kok lu ngaco',
  recentTurns: [
    { role: 'user' as const, text: 'hai' },
    { role: 'assistant' as const, text: 'Halo! Saya SNOUTY.' },
  ],
  fallback: 'Teks tetap.',
};

describe('ReplyWriter', () => {
  it('memakai teks model bila bentuknya benar dan lolos pagar', async () => {
    const writer = new ReplyWriter(ai({ text: 'Maaf, maksud Anda yang mana?' }), 'sys');
    expect(await writer.write(base)).toEqual({
      text: 'Maaf, maksud Anda yang mana?',
      source: 'llm',
    });
  });

  it('angka yang tidak ada di DATA → teks tetap', async () => {
    const writer = new ReplyWriter(ai({ text: 'Tekanan kerjanya 10 bar.' }), 'sys');
    expect(await writer.write({ ...base, facts: 'Material uPVC.' })).toMatchObject({
      source: 'fallback',
    });
  });

  it('angka yang ada di DATA boleh', async () => {
    const writer = new ReplyWriter(ai({ text: 'Standarnya SNI 06-0084, ya.' }), 'sys');
    const result = await writer.write({ ...base, facts: 'Standar: SNI 06-0084' });
    expect(result.source).toBe('llm');
  });

  it('menyebut merek lain → teks tetap', async () => {
    const writer = new ReplyWriter(ai({ text: 'Rucika juga bagus kok.' }), 'sys');
    expect((await writer.write(base)).source).toBe('fallback');
  });

  it('batas panjang: 700 untuk percakapan, pemanggil boleh melonggarkannya (jalur FAQ)', async () => {
    const long = 'a'.repeat(1200);
    const writer = new ReplyWriter(ai({ text: long }), 'sys');
    expect((await writer.write(base)).source).toBe('fallback');
    expect(await writer.write({ ...base, maxLength: 1800 })).toEqual({ text: long, source: 'llm' });
  });

  it('bentuk salah atau model gagal → teks tetap', async () => {
    expect((await new ReplyWriter(ai({ reply: 'x' }), 'sys').write(base)).source).toBe('fallback');
    expect((await new ReplyWriter(ai(null), 'sys').write(base)).source).toBe('fallback');
    const throwing = {
      writeProse: async () => {
        throw new Error('putus');
      },
    };
    expect((await new ReplyWriter(throwing, 'sys').write(base)).source).toBe('fallback');
  });

  it('konteks memuat giliran terakhir, pesan sekarang, dan DATA berpembatas', () => {
    const context = buildReplyContext({ ...base, facts: 'Material uPVC.' });
    expect(context).toContain('Pengguna: hai');
    expect(context).toContain('SNOUTY: Halo! Saya SNOUTY.');
    expect(context).toContain('PESAN PENGGUNA SEKARANG: kok lu ngaco');
    expect(context).toContain('--- MULAI DATA');
    expect(context).toContain('Material uPVC.');
  });
});

describe('passesGuards', () => {
  it('tanpa DATA hanya 0, 1, 2 yang boleh', () => {
    expect(passesGuards('Ada 2 cara.', undefined)).toBe(true);
    expect(passesGuards('Biasanya 3 lantai.', undefined)).toBe(false);
  });
});
