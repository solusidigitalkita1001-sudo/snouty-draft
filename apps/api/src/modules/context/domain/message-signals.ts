/**
 * Isyarat deterministik di teks pesan — pelengkap klasifikasi model, bukan penggantinya.
 * docs/AI_BEHAVIOR.md §4 ("intent sadar konteks").
 *
 * Model 7B mengklasifikasi "lebih bagus PVC atau HDPE buat rumah 2 lantai?" sebagai
 * `PRODUCT_LOOKUP` karena kata PVC/HDPE — padahal pesan itu membawa kebutuhan (rumah, 2 lantai)
 * dan meminta rekomendasi. Aturan presedensinya hidup di sini, di kode, supaya tidak bergantung
 * pada model mana yang sedang dipakai.
 */

/**
 * Pesan membawa isyarat kebutuhan bangunan/instalasi — termasuk jenis instalasi (drainase,
 * irigasi, limbah) dan kata "proyek": "rekomendasi produk buat proyek drainase sawah" adalah
 * kebutuhan (yang lalu ditolak kebijakan cakupan), bukan pertanyaan produk.
 */
const REQUIREMENT_SIGNALS =
  /\b(lantai|kamar mandi|wastafel|dapur|toren|tandon|pdam|sumur|pompa|rumah|ruko|kos|kost|gedung|pabrik|gudang|kantor|sekolah|hotel|titik air|keran|drainase|irigasi|limbah|saluran|pembuangan|air bersih|proyek|project|instalasi|sawah|kebun)\b/i;

/** Pesan meminta pilihan/rekomendasi, bukan definisi. */
const ADVICE_SIGNALS =
  /\b(lebih (bagus|baik|cocok|tepat|pas)|bagusan|mending|mendingan|sebaiknya|cocoknya|pilih|pakai (pipa |bahan )?(apa|mana|yang mana)|rekomendasi(kan)?|saran(kan)?)\b/i;

export function hasRequirementSignals(message: string): boolean {
  return REQUIREMENT_SIGNALS.test(message);
}

export function asksAdvice(message: string): boolean {
  return ADVICE_SIGNALS.test(message);
}
