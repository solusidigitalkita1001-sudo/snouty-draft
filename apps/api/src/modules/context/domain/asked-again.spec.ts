import { describe, expect, it } from 'vitest';
import type { ReplyTurn } from '../application/reply-writer.js';
import { asksAgain } from './asked-again.js';

describe('asksAgain', () => {
  const turns = (...texts: readonly string[]): ReplyTurn[] =>
    texts.map((text, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', text }));

  it('pertanyaan yang sama persis diketik ulang', () => {
    expect(
      asksAgain(
        'pipa pn 16 ditimbun 2 meter aman?',
        turns('pipa pn 16 ditimbun 2 meter aman?', 'Umur pakai pipa…'),
      ),
    ).toBe(true);
  });

  it('beda tanda baca, huruf besar, dan spasi tetap pertanyaan yang sama', () => {
    expect(
      asksAgain(
        '  Pipa PN 16, ditimbun 2 meter — aman?  ',
        turns('pipa pn 16 ditimbun 2 meter aman', 'Umur pakai pipa…'),
      ),
    ).toBe(true);
  });

  it('pertanyaan lain atas topik yang sama bukan pengulangan', () => {
    expect(
      asksAgain(
        'kenapa harus pakai pompa transfer?',
        turns('pompanya apa', 'Pompa bukan produk Pralon…'),
      ),
    ).toBe(false);
  });

  it('tanpa giliran pengguna sebelumnya tidak ada yang diulang', () => {
    expect(asksAgain('pompanya apa', [{ role: 'assistant', text: 'Halo' }])).toBe(false);
  });

  it('pesan kosong bukan pengulangan', () => {
    expect(asksAgain('   ', turns('   ', 'Halo'))).toBe(false);
  });
});
