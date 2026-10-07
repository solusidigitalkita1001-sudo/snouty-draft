import { describe, expect, it } from 'vitest';
import { socialKind, socialReply } from './social.js';

describe('socialKind — pesan tanpa isi: terima kasih, persetujuan, pamit', () => {
  it.each([
    ['ok makasih', 'thanks'],
    ['makasih ya jo', 'thanks'],
    ['terima kasih banyak', 'thanks'],
    ['thanks!', 'thanks'],
    ['ok', 'ack'],
    ['oke sip', 'ack'],
    ['siap, noted', 'ack'],
    ['bye', 'bye'],
    ['sampai jumpa', 'bye'],
  ])('"%s" → %s', (message, kind) => {
    expect(socialKind(message)).toBe(kind);
  });

  it.each([
    'ok lanjut',
    'makasih, terus bedanya sama pipa AW apa?',
    'pralon itu apa?',
    'ok jadi pipa mana yang cocok?',
    'boleh',
    'semuanya',
    '',
  ])('"%s" membawa isi → null', (message) => {
    expect(socialKind(message)).toBeNull();
  });

  it('balasan tetap per bahasa', () => {
    expect(socialReply('ok makasih')).toMatch(/^Sama-sama/);
    expect(socialReply('ok makasih', 'en')).toMatch(/^You are welcome/);
    expect(socialReply('ok', 'en')).toMatch(/^Noted/);
    expect(socialReply('pipa apa?')).toBeNull();
  });
});
