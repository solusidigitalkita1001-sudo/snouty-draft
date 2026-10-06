/**
 * Teks workspace solusi (layar 06) dan kartu produk (layar 07), apa adanya dari desain.
 *
 * Dua kalimat **tidak boleh diparafrase** karena membawa janji produk, bukan redaksi
 * (docs/DESIGN_IMPLEMENTATION.md §10): disclaimer panduan perencanaan dan label skema.
 */

export const SOLUTION_COPY = {
  summaryKicker: 'RINGKASAN',
  statsLabels: {
    outletCount: 'Titik air',
    mainSize: 'Jalur utama',
    branch: 'Cabang',
    fixture: 'Sambungan fixture',
    products: 'Produk Pralon',
  },
  systemTitle: 'Rekomendasi Sistem',
  showTechnical: 'Tampilkan detail teknis',
  hideTechnical: 'Sembunyikan detail teknis',
  technicalKicker: 'DETAIL TEKNIS',
  bomTitle: 'Perkiraan Material',
  bomColumns: {
    item: 'Item',
    size: 'Ukuran',
    quantity: 'Jumlah',
    basis: 'DASAR PERHITUNGAN',
  },
  assumptionsTitle: 'Asumsi yang digunakan',
  fixAssumption: 'Perbaiki asumsi ini →',
  productsTitle: 'Produk Pralon yang sesuai',

  // Janji produk — jangan diparafrase.
  planningDisclaimer: 'PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS',
  schematicDisclaimer: 'SKEMATIK · BUKAN GAMBAR KERJA',
  /** Tab "Skema" di layar solusi: gambarnya hidup di halaman /schematic; tab ini pengantarnya. */
  schematicKicker: 'SKEMA',
  schematicNote:
    'Skema instalasi dibentuk dari kebutuhan dan rekomendasi ini: sumber air, riser, cabang per lantai, dan titik air.',
  priceDisclaimer: 'Perkiraan perencanaan, bukan penawaran resmi.',

  matchStateLabel: {
    VERIFIED_SELECTED: 'DIPAKAI DI SOLUSI INI',
    SIZE_NEEDS_VALIDATION: 'UKURAN PERLU DIKONFIRMASI',
    INFORMATION_UNAVAILABLE: 'DATA BELUM LENGKAP',
  },
} as const;
