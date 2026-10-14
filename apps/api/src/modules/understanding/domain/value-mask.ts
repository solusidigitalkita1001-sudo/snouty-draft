/**
 * Menyamarkan nilai terstruktur (angka, ukuran, satuan) sebelum kalimat dibandingkan dengan contoh.
 *
 * Untuk katalog yang menanyakan *apa* yang ditanya (aspek produk), ukurannya tidak relevan — tetapi
 * penyandi teks memberi bobot besar pada token ukuran: "berapa harga pipa d 4 inch?" lebih mirip
 * "tebal pipa d 4 inch berapa?" daripada "tebal pipa d 6 inci berapa?" (QA smoke 2026-10-14).
 * Ini parser nilai, bukan daftar pertanyaan: yang diganti hanya angka beserta satuannya.
 */
const VALUE = /\d+(?:\s+\d+\/\d+|\/\d+|[.,]\d+)?\s*(?:mm|inch|inci|in\b|"|”|meter|m\b)?/gi;

export function maskValues(text: string): string {
  return text.toLowerCase().replace(VALUE, ' N ').replace(/\s+/g, ' ').trim();
}
