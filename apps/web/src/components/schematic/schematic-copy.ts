/**
 * Teks skema (layar 09 dan pratinjau layar 06), apa adanya dari desain.
 *
 * Dua penegasan di `MANDATORY_NOTES` **tidak boleh diparafrase dan tidak boleh
 * disembunyikan** (invarian S-1). Keduanya bukan disclaimer hukum yang ditempel
 * belakangan, melainkan pernyataan tepat tentang apa yang sistem memang tahu: ia tidak
 * punya denah bangunan, jadi ia tidak tahu posisi fisik apa pun.
 */

export const SCHEMATIC_COPY = {
  title: 'Skema Instalasi',
  routeListTitle: 'DAFTAR JALUR',
  titleBlockLabels: {
    drawing: 'GAMBAR',
    scale: 'SKALA',
    floorHeight: 'TINGGI LANTAI',
    source: 'SUMBER',
  },
  legend: [
    { label: 'Jalur utama & riser', role: 'main' as const },
    { label: 'Cabang per lantai', role: 'branch' as const },
    { label: 'Sambungan fixture', role: 'fixture_connection' as const },
    { label: 'Tee + reducer', role: 'fitting' as const },
  ],
  groundLabel: '±0.00 MUKA TANAH',
  /** Alternatif teks untuk pembaca layar (§8) — ringkasan terstruktur, bukan "gambar". */
  ariaIntro: 'Skema instalasi air bersih, disajikan sebagai daftar jalur per lantai.',
} as const;

/** Invarian S-1 — tidak ada mode yang menghilangkan keduanya. */
export const MANDATORY_NOTES = {
  banner: 'SKEMATIK · BUKAN GAMBAR KERJA',
  noteTitle: 'CATATAN SKEMA',
  noteBody:
    'Skema menunjukkan hubungan antar jalur, bukan posisi fisik pipa di bangunan. Panjang jalur dan posisi shaft ditentukan saat pelaksanaan.',
} as const;
