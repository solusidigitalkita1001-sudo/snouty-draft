import { describe, expect, it } from 'vitest';
import { understood } from '../../understanding/testing/understood.js';
import { socialKind, socialReply } from './social.js';

describe('socialKind — pesan tanpa isi: terima kasih, persetujuan, pamit', () => {
  it('bentuk sosial yang dikenali pemahaman, tanpa produk/kebutuhan → jenisnya', () => {
    expect(socialKind(understood('ok makasih', { intent: 'thanks' }))).toBe('thanks');
    expect(socialKind(understood('oke sip', { intent: 'ack' }))).toBe('ack');
    expect(socialKind(understood('sampai jumpa', { intent: 'bye' }))).toBe('bye');
  });

  it('bentuk sosial yang membawa isi (produk, kebutuhan, pesaing) → null, bukan balasan basa-basi', () => {
    expect(
      socialKind(understood('makasih, terus bedanya sama pipa AW apa?', { intent: 'thanks' })),
    ).toBeNull();
    expect(socialKind(understood('ok, rumah 2 lantai ya', { intent: 'ack' }))).toBeNull();
    expect(socialKind(understood('sip, rucika gimana?', { intent: 'ack' }))).toBeNull();
  });

  it('intent lain (lanjutan, perusahaan, tanpa label) → null', () => {
    expect(socialKind(understood('boleh', { intent: 'follow_up_continue' }))).toBeNull();
    expect(socialKind(understood('pralon itu apa?', { intent: 'company_question' }))).toBeNull();
    expect(socialKind(understood('ok lanjut', { intent: null }))).toBeNull();
  });

  it('balasan tetap per bahasa', () => {
    expect(socialReply(understood('ok makasih', { intent: 'thanks' }))).toMatch(/^Sama-sama/);
    expect(socialReply(understood('ok makasih', { intent: 'thanks' }), 'en')).toMatch(
      /^You are welcome/,
    );
    expect(socialReply(understood('ok', { intent: 'ack' }), 'en')).toMatch(/^Noted/);
    expect(socialReply(understood('pipa apa?', { intent: null }))).toBeNull();
  });

  it('keluhan ("dongo") → minta maaf dan minta diperjelas, bukan perkenalan ulang (2026-10-09)', () => {
    const reply = socialReply(understood('dongo', { intent: 'complaint' }));
    expect(reply).toMatch(/^Maaf, jawaban saya tadi belum pas\./);
    expect(reply).not.toContain('Silakan, tanyakan saja');
  });
});
