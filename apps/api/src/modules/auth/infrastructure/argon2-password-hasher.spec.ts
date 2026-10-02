/**
 * P3-02a — password tidak pernah dicatat maupun dikembalikan, dan hash yang rusak
 * tidak boleh menjatuhkan login.
 *
 * Tes ini memanggil Argon2 sungguhan, bukan mock. Parameter KDF adalah satu-satunya
 * hal yang membuat hash password berarti; mock akan membuktikan fungsi dipanggil dan
 * tidak membuktikan apa pun tentang itu. Konsekuensinya berkas ini lebih lambat dari
 * spec lain — dan itu memang biaya yang sedang diukur.
 */
import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';

const PASSWORD = 'sandi-pengembangan-yang-panjang';

function hasher(): Argon2PasswordHasher {
  return new Argon2PasswordHasher();
}

describe('Argon2PasswordHasher — bentuk hash', () => {
  it('memakai varian id, bukan Argon2i atau Argon2d', async () => {
    const stored = await hasher().hash(PASSWORD);

    expect(stored.startsWith('$argon2id$')).toBe(true);
  });

  it('menuliskan parameter KDF di dalam hash, sehingga bisa diaudit', async () => {
    // Parameter yang tersimpan di hash itulah yang dipakai memverifikasi nanti;
    // tanpa itu, menaikkan biaya KDF akan mematikan seluruh password lama.
    const stored = await hasher().hash(PASSWORD);

    expect(stored).toContain('m=19456,t=2,p=1');
  });

  it('tidak pernah memuat passwordnya di dalam hash', async () => {
    const stored = await hasher().hash(PASSWORD);

    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain('sandi');
  });

  it('menghasilkan hash berbeda untuk password yang sama — salt per hash', async () => {
    // Hash yang sama untuk password yang sama berarti satu tabel pelangi melayani
    // seluruh basis pengguna.
    const [a, b] = await Promise.all([hasher().hash(PASSWORD), hasher().hash(PASSWORD)]);

    expect(a).not.toBe(b);
  });

  it('menghasilkan hash yang cukup pendek untuk kolom VARCHAR(255)', async () => {
    const stored = await hasher().hash(PASSWORD);

    expect(stored.length).toBeLessThanOrEqual(255);
  });
});

describe('Argon2PasswordHasher — verifikasi', () => {
  it('menerima password yang benar', async () => {
    const stored = await hasher().hash(PASSWORD);

    expect(await hasher().verify(stored, PASSWORD)).toBe(true);
  });

  it('menolak password yang salah', async () => {
    const stored = await hasher().hash(PASSWORD);

    expect(await hasher().verify(stored, PASSWORD + 'x')).toBe(false);
  });

  it('menolak password yang hanya beda huruf besar-kecil', async () => {
    const stored = await hasher().hash(PASSWORD);

    expect(await hasher().verify(stored, PASSWORD.toUpperCase())).toBe(false);
  });

  it('memverifikasi hash yang dibuat instance lain — tidak ada state di dalamnya', async () => {
    const stored = await hasher().hash(PASSWORD);

    expect(await hasher().verify(stored, PASSWORD)).toBe(true);
  });
});

describe('Argon2PasswordHasher — hash yang rusak', () => {
  const broken = [
    ['kosong', ''],
    ['bukan hash', 'bukan-hash-sama-sekali'],
    ['terpotong', '$argon2id$v=19$m=19456,t=2,p=1$'],
    ['algoritme lain', '$2b$12$abcdefghijklmnopqrstuv'],
    ['parameter rusak', '$argon2id$v=19$m=xx,t=yy,p=zz$c2FsdA$aGFzaA'],
  ] as const;

  for (const [label, value] of broken) {
    it(`mengembalikan false, bukan melempar, untuk hash ${label}`, async () => {
      // Satu baris rusak di database tidak boleh mengubah login menjadi galat 500
      // untuk semua orang.
      await expect(hasher().verify(value, PASSWORD)).resolves.toBe(false);
    });
  }
});
