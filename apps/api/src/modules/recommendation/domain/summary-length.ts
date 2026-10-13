/**
 * Ringkasan solusi maksimal dua kalimat (DD-01 #5, keputusan pemilik 2026-10-13: "terlalu banyak
 * teks"). Ditegakkan di kode, bukan di prompt — prompt hanya permintaan, kode adalah aturannya.
 * Rinciannya sudah ada di tabel dasar perhitungan dan asumsi.
 */

export const SUMMARY_MAX_SENTENCES = 2;

/**
 * Potong setelah kalimat ke-`max`. Akhir kalimat = titik, tanya, atau seru yang diikuti spasi
 * dan huruf besar/angka/kutip — desimal Indonesia memakai koma, jadi "1,5 m" tidak terpotong.
 */
export function firstSentences(text: string, max = SUMMARY_MAX_SENTENCES): string {
  const sentences = text.trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/);
  return sentences.slice(0, max).join(' ');
}
