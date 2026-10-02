/**
 * Argon2id. docs/SECURITY.md §3.
 *
 * Parameternya dituliskan **eksplisit** walaupun kebetulan sama dengan nilai baku
 * pustaka. Parameter KDF adalah hal yang akan diaudit, dan "apa pun yang menjadi
 * baku di versi pustaka yang terpasang" bukan jawaban yang bisa diaudit. Nilai
 * yang dipakai adalah rekomendasi minimum OWASP untuk Argon2id:
 *
 *   memori 19 MiB · 2 iterasi · paralelisme 1
 *
 * Satu catatan tentang paralelisme 1: Argon2 memakai memori sebanyak `memoryCost`
 * **per hash**, dan login adalah endpoint yang bisa dibanjiri. Paralelisme tinggi
 * mempercepat satu hash tetapi memperbesar biaya serangan kelelahan sumber daya,
 * jadi yang dinaikkan kalau perlu lebih kuat adalah memori atau iterasi.
 *
 * Varian **id**, bukan Argon2i atau Argon2d: id adalah hibrida yang direkomendasikan
 * untuk hashing password karena ia menahan serangan side-channel sekaligus serangan
 * GPU, sementara dua varian lain hanya menahan salah satunya.
 */
import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { PASSWORD_HASHER, type PasswordHasher } from '../domain/password-hasher.port.js';

/**
 * `Algorithm.Argon2id` dari `@node-rs/argon2`, ditulis sebagai angka.
 *
 * Enum-nya dideklarasikan `const enum`, yang tidak bisa dibaca saat
 * `isolatedModules` menyala — dan mematikan opsi itu demi satu konstanta adalah
 * pertukaran yang salah arah. Angkanya dipaku oleh tes yang memeriksa hash hasilnya
 * benar-benar berawalan `$argon2id$`, jadi nilai yang salah tidak akan lolos diam-diam.
 */
const ARGON2ID = 2;

/** Rekomendasi minimum OWASP untuk Argon2id. Dinaikkan lewat memori, bukan paralelisme. */
const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(plaintext: string): Promise<string> {
    return hash(plaintext, OPTIONS);
  }

  async verify(storedHash: string, plaintext: string): Promise<boolean> {
    try {
      return await verify(storedHash, plaintext, OPTIONS);
    } catch {
      // Hash yang tidak bisa diurai diperlakukan sebagai password salah, bukan
      // sebagai kegagalan sistem. Satu baris rusak di database tidak boleh
      // mengubah login menjadi galat 500 untuk semua orang — dan galatnya tidak
      // boleh membocorkan bahwa baris itu ada.
      return false;
    }
  }
}

export const passwordHasherProvider = {
  provide: PASSWORD_HASHER,
  useFactory: (): PasswordHasher => new Argon2PasswordHasher(),
};
