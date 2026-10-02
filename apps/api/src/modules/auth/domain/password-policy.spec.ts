/**
 * Aturan password: panjang saja, tanpa aturan komposisi.
 */
import { describe, expect, it } from 'vitest';
import { checkPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password-policy.js';

describe('checkPassword', () => {
  it('menerima password sepanjang batas minimum', () => {
    expect(checkPassword('a'.repeat(PASSWORD_MIN_LENGTH))).toBeNull();
  });

  it('menolak password satu karakter di bawah batas', () => {
    expect(checkPassword('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe('too_short');
  });

  it('menolak password yang hanya spasi walau panjangnya cukup', () => {
    expect(checkPassword(' '.repeat(PASSWORD_MIN_LENGTH + 5))).toBe('only_whitespace');
  });

  it('menolak password yang terlalu panjang — pagar sumber daya, bukan aturan keamanan', () => {
    // Argon2id menghitung di atas masukan sepanjang apa pun; password 1 MB adalah
    // permintaan yang menghabiskan CPU server, bukan permintaan masuk.
    expect(checkPassword('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe('too_long');
  });

  it('tidak mewajibkan huruf besar, angka, maupun simbol', () => {
    // Aturan komposisi menghasilkan `Password1!` — mudah ditebak mesin, sulit
    // diingat manusia. Panjang satu-satunya ukuran yang berkorelasi dengan kekuatan.
    expect(checkPassword('kucing oranye duduk di atap')).toBeNull();
    expect(checkPassword('aaaaaaaaaaaa')).toBeNull();
  });

  it('menghitung emoji sebagai satu karakter, bukan dua', () => {
    // Menghitung unit UTF-16 membuat aturan panjangnya terasa acak bagi pengguna.
    const twelveEmoji = '🙂'.repeat(12);

    expect(checkPassword(twelveEmoji)).toBeNull();
    expect(checkPassword('🙂'.repeat(11))).toBe('too_short');
  });
});
