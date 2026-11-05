/**
 * Pertanyaan yang SAMA ditanyakan lagi.
 *
 * Pagar pengulangan ("Itu yang saya jelaskan di jawaban sebelumnya") lahir dari kasus lain: DUA
 * pertanyaan berbeda yang jatuh ke teks yang sama persis — dua pertanyaan pompa berurutan
 * mendapat empat paragraf identik (produksi 2026-10-26). Di luar kasus itu ia merugikan. Orang
 * yang mengetik ulang pertanyaannya kata demi kata sedang mengatakan jawaban tadi tidak sampai;
 * membalasnya "bagian mana yang mau saya perjelas?" adalah menolak menjawab untuk kedua kalinya
 * (produksi 2026-11-05: pertanyaan pipa tertimbun yang diulang, lalu "Masih belum menjawab").
 *
 * Hal yang sama berlaku saat keluhan membuat pertanyaan sebelumnya dijawab ulang: pesan yang
 * dijalankan adalah pertanyaan itu sendiri, jadi ia selalu sama dengan giliran pengguna terakhir
 * — dan justru jawabannya yang diminta.
 *
 * Perbandingannya struktural (huruf dan angka pesan), bukan tebakan isi: tidak ada daftar frasa.
 */
/** Bentuk minimal giliran percakapan; domain tidak mengimpor tipe lapisan application. */
interface Turn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

/** Huruf dan angka saja, huruf kecil: beda tanda baca dan spasi bukan pertanyaan yang lain. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Pesan ini mengulang giliran pengguna terakhir. `recentTurns` tidak memuat pesan yang sedang
 * diproses, jadi giliran pengguna terakhir di dalamnya adalah pertanyaan sebelumnya.
 */
export function asksAgain(message: string, recentTurns: readonly Turn[] = []): boolean {
  const previous = [...recentTurns].reverse().find((t) => t.role === 'user')?.text;
  if (previous === undefined) return false;
  const now = normalize(message);
  return now !== '' && now === normalize(previous);
}
