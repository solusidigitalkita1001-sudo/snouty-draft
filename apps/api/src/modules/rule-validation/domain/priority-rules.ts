/**
 * Delapan aturan yang ditinjau lebih dulu (keputusan pemilik 2026-10-28).
 *
 * Tujuh puluh empat aturan tidak ditandatangani dalam satu duduk, dan memintanya begitu hanya
 * melatih orang menekan setuju tanpa membaca. Yang dipilih di sini adalah aturan yang
 * menggerakkan angka terbesar di layar pengguna: lima di jalur air bersih rumah — beban alat,
 * jalur dan titik tertinggi, diameter, dan kecukupan toren — ditambah tiga aturan pembuangan
 * yang angkanya baru pindah dari IPC ke UPC (P31-72) dan karena itu paling pantas diperiksa.
 *
 * `docs/KEPUTUSAN_DIBUTUHKAN.md` §2 dulu menyebut ENG-002, ENG-009, dan ENG-011. Ketiganya
 * sudah tidak dijalankan sejak Kelompok K menggantikannya (2026-10-12); penggantinya yang ada
 * di daftar ini.
 *
 * Sisanya tetap tampil di layar, di bawah, dengan urutan registry — tidak disembunyikan. Daftar
 * ini soal URUTAN BACA, bukan soal mana yang boleh ditandatangani.
 */
export interface PriorityRule {
  readonly ruleId: string;
  /** Mengapa aturan ini lebih dulu — kalimat yang dibaca ahlinya di layar. */
  readonly why: string;
  readonly whyEn: string;
}

export const PRIORITY_RULES: readonly PriorityRule[] = [
  {
    ruleId: 'ENG-701',
    why: 'Beban alat dan debit puncak sebuah rumah. Setiap ukuran pipa air bersih berdiri di atas angka ini, dan kurva debit puncaknya diambil dari IPC karena kurva UPC hanya terbit sebagai grafik.',
    whyEn:
      'A house’s fixture load and peak demand. Every clean-water pipe size stands on this figure, and its peak-demand curve comes from the IPC because the UPC curve is published only as a graph.',
  },
  {
    ruleId: 'ENG-205',
    why: 'Diameter pipa yang akhirnya disebut ke pengguna: kandidat dari tabel nominal, lalu disaring kecepatan dan kehilangan tekanan. Batas 2 m/s dan 10 m per 100 m itu yang perlu dinilai.',
    whyEn:
      'The diameter the user is finally told: a candidate from the nominal table, filtered by velocity and head loss. The 2 m/s and 10 m per 100 m limits are what need judging.',
  },
  {
    ruleId: 'ENG-702',
    why: 'Titik tertinggi dan panjang jalur. Keduanya masukan bagi diameter dan bagi kecukupan toren — salah di sini menjalar ke dua angka sekaligus.',
    whyEn:
      'Highest point and route length. Both feed the diameter and the tank check — an error here spreads to two figures at once.',
  },
  {
    ruleId: 'ENG-703',
    why: 'Menyatakan toren atap cukup atau perlu pompa pendorong. Ambang 0,3 bar di titik tertinggi adalah satu angka yang menentukan apakah pengguna disuruh membeli pompa.',
    whyEn:
      'Declares a roof tank enough or a booster pump needed. The 0.3 bar threshold at the highest point alone decides whether the user is told to buy a pump.',
  },
  {
    ruleId: 'ENG-001',
    why: 'Unit beban fixture dan jumlah titik air. Dasar yang paling lama dipakai, dan bobot 2 per kamar mandi berasal dari anggapan "1 kamar mandi = shower + kloset" (ENG-012).',
    whyEn:
      'Fixture load units and the number of water points. The oldest basis in the engine, and the weight of 2 per bathroom comes from assuming "1 bathroom = shower + toilet" (ENG-012).',
  },
  {
    ruleId: 'ENG-601',
    why: 'Beban alat pembuangan. Angkanya baru pindah dari IPC ke UPC Tabel 702.1, dan baris urinoir belum terbaca — ia masih memakai angka lama.',
    whyEn:
      'Drainage fixture units. The figures just moved from IPC to UPC Table 702.1, and the urinal row is unread — it still uses the old number.',
  },
  {
    ruleId: 'ENG-604',
    why: 'Diameter pipa tegak dan cabang pembuangan dari UPC Tabel 703.2. Kolom 2½" yang dipakai belum disahkan siapa pun.',
    whyEn:
      'Drainage stack and branch diameters from UPC Table 703.2. The 2½" column in use has not been confirmed by anyone.',
  },
  {
    ruleId: 'ENG-602',
    why: 'Ukuran ventilasi mengikuti UPC 904.1: setengah diameter saluran, minimum 1¼". Salah di sini berarti perangkap air tersedot dan bau masuk ke ruangan.',
    whyEn:
      'Vent sizing follows UPC 904.1: half the drain diameter, minimum 1¼". Wrong here means traps siphon and odour enters the room.',
  },
];

/** Urutan baca: yang prioritas lebih dulu, sisanya mengikuti urutan registry. */
export function priorityIndex(ruleId: string): number {
  const at = PRIORITY_RULES.findIndex((rule) => rule.ruleId === ruleId);
  return at === -1 ? Number.MAX_SAFE_INTEGER : at;
}
