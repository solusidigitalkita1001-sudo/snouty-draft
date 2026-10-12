/**
 * ULID — pengenal 26 karakter yang terurut waktu sekaligus tidak mudah ditebak.
 *
 * Ditulis sendiri alih-alih menambah dependensi karena ukurannya memang sebesar
 * ini, dan karena satu-satunya hal yang perlu dijamin sudah dijamin skema:
 * seluruh kolom id adalah `CHAR(26)` (docs/DATABASE.md §5).
 *
 * Terurut waktu itu penting bukan demi kerapian: id yang monoton membuat
 * penyisipan ke indeks B-tree tetap di ujung, bukan menyebar ke tengah halaman.
 * Pada server yang dipakai bersama delapan aplikasi, itu bedanya nyata.
 */
import { randomBytes } from 'node:crypto';

/** Crockford base32 — tanpa I, L, O, dan U supaya tidak tertukar saat dibaca manusia. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

let lastTime = -1;
let lastRandom = '';

/**
 * Monoton dalam satu proses (spesifikasi ULID "monotonic"): id yang dibuat pada milidetik yang sama
 * menaikkan bagian acaknya satu, bukan mengacak ulang. Temuan laporan SNTY-2026-10-0010: trace
 * satu rekomendasi dibuat dalam milidetik yang sama, dan laporan yang mengurutkan menurut id
 * mencetak langkah hitung dalam urutan acak.
 */
export function ulid(now: number = Date.now()): string {
  const time = Math.floor(now);
  if (time === lastTime && lastRandom !== '') {
    const next = incrementBase32(lastRandom);
    if (next !== null) {
      lastRandom = next;
      return encodeTime(time) + next;
    }
  }
  lastTime = time;
  lastRandom = encodeRandom();
  return encodeTime(time) + lastRandom;
}

/** +1 dalam Crockford base32; `null` bila semua digit sudah maksimum (praktis tidak terjadi). */
function incrementBase32(value: string): string | null {
  const digits = value.split('');
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    const index = ALPHABET.indexOf(digits[i]!);
    if (index < ALPHABET.length - 1) {
      digits[i] = ALPHABET[index + 1]!;
      return digits.join('');
    }
    digits[i] = ALPHABET[0]!;
  }
  return null;
}

function encodeTime(milliseconds: number): string {
  let value = Math.floor(milliseconds);
  let encoded = '';
  for (let position = 0; position < TIME_LENGTH; position += 1) {
    encoded = ALPHABET[value % 32] + encoded;
    value = Math.floor(value / 32);
  }
  return encoded;
}

function encodeRandom(): string {
  // 256 habis dibagi 32, jadi `byte % 32` tetap seragam — tidak ada modulo bias.
  const bytes = randomBytes(RANDOM_LENGTH);
  let encoded = '';
  for (const byte of bytes) encoded += ALPHABET[byte % 32];
  return encoded;
}
