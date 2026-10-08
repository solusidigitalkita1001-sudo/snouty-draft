/**
 * Port penyandi teks (embedding) — teks menjadi vektor, supaya kemiripan makna bisa dihitung
 * tanpa memanggil model generatif.
 *
 * Dipakai modul `understanding` untuk memutuskan apa yang ditanya pengguna dari CONTOH kalimat
 * yang hidup sebagai data (aturan proyek 2026-10-07: pertanyaan pengguna tidak pernah di-hardcode).
 * Port ini tidak tahu apa pun tentang label atau contoh; ia hanya menyandikan.
 */
export const TEXT_ENCODER = Symbol('TEXT_ENCODER');

export interface TextEncoder {
  /** Identitas model penyandi — vektor dari model berbeda tidak boleh dibandingkan. */
  readonly id: string;
  /** Satu vektor ternormalisasi (panjang 1) per teks, urutan sama dengan masukan. */
  encode(texts: readonly string[]): Promise<readonly Float32Array[]>;
}
