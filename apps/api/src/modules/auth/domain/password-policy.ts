/**
 * Aturan password yang diterima saat registrasi dan penggantian password.
 *
 * **Panjang minimum 12 karakter, dan tidak ada aturan komposisi.** Mewajibkan
 * huruf besar, angka, dan simbol menghasilkan `Password1!` — pola yang mudah
 * ditebak mesin dan sulit diingat manusia. Panjang adalah satu-satunya ukuran yang
 * benar-benar berkorelasi dengan kekuatan, jadi ia satu-satunya yang diwajibkan.
 *
 * Batas atas ada bukan sebagai aturan keamanan melainkan sebagai pagar sumber
 * daya: Argon2id menghitung di atas masukan sepanjang apa pun, dan password 1 MB
 * adalah permintaan yang menghabiskan CPU server, bukan permintaan masuk.
 *
 * Yang **belum** ada: pemeriksaan terhadap daftar password yang pernah bocor.
 * NIST SP 800-63B menyebut itu lebih berguna daripada aturan komposisi mana pun,
 * dan ia menunggu kebutuhan konkret — mengunduh korpus 600 juta baris untuk
 * aplikasi yang belum punya pengguna adalah kerumitan tanpa imbalan.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

export type PasswordRejection = 'too_short' | 'too_long' | 'only_whitespace';

/** `null` berarti diterima. */
export function checkPassword(plaintext: string): PasswordRejection | null {
  if (plaintext.trim() === '') return 'only_whitespace';
  // Panjang dihitung dalam titik kode, bukan unit UTF-16: emoji adalah satu
  // karakter bagi pengguna, dan menghitungnya dua membuat aturannya terasa acak.
  const length = [...plaintext].length;
  if (length < PASSWORD_MIN_LENGTH) return 'too_short';
  if (length > PASSWORD_MAX_LENGTH) return 'too_long';
  return null;
}
