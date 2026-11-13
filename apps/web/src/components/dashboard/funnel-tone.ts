/**
 * Seberapa pekat sebuah kartu tahap 5A diwarnai.
 *
 * Sebelumnya kepekatannya diambil dari URUTAN kolomnya: tahap paling kanan selalu paling pekat,
 * jadi kartu bertuliskan 0 menjadi benda paling mencolok di layar dan kartu dengan paling banyak
 * orang nyaris putih. Warna yang terbaca sebagai "banyak" tidak boleh berarti "paling kanan".
 *
 * Sekarang kepekatannya mengikuti jumlahnya terhadap tahap yang paling ramai: nol tidak diwarnai
 * sama sekali, dan tahap teramai mendapat tingkat tertinggi. Skalanya lima tingkat karena itu yang
 * ada di token (`statTone1`…`statTone5`).
 */
export const TONE_STEPS = 5;

export function funnelTone(value: number, busiest: number): number {
  if (value <= 0 || busiest <= 0) return 0;
  return Math.max(1, Math.ceil((value / busiest) * TONE_STEPS));
}
