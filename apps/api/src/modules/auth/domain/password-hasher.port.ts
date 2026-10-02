/**
 * Port hash password. docs/SECURITY.md §3.
 *
 * Interface-nya sengaja hanya dua method, dan keduanya **tidak pernah**
 * mengembalikan password apa pun. Tidak ada `getPassword`, tidak ada
 * `comparePlaintext` yang mengembalikan nilainya — satu-satunya jawaban yang bisa
 * diminta dari `verify` adalah boolean.
 */

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export interface PasswordHasher {
  /** Mengembalikan hash ter-encode (memuat algoritme, parameter, dan salt-nya). */
  hash(plaintext: string): Promise<string>;

  /**
   * `false` untuk password salah **maupun** untuk hash yang rusak.
   *
   * Hash yang tidak bisa diurai tidak boleh melempar: satu baris rusak di database
   * akan membuat login seluruhnya gagal dengan galat 500, dan galat 500 pada login
   * adalah cara tercepat mengubah satu baris buruk menjadi insiden.
   */
  verify(hash: string, plaintext: string): Promise<boolean>;
}
