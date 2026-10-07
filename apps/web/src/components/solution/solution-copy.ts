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
  /** Statistik solusi irigasi (OQ-47) — belum didesain; label mengikuti pola bangunan. */
  irrigationStats: {
    area: 'Luas lahan',
    flow: 'Debit rencana',
    pump: 'Pompa',
    pumpYes: 'Diperlukan',
    pumpNo: 'Gravitasi',
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
  schematicLoading: 'Menyiapkan skema…',
  schematicUnavailable: 'Skema belum tersedia untuk konsultasi ini.',
  priceDisclaimer: 'Perkiraan perencanaan, bukan penawaran resmi.',

  /**
   * Bagian tetap jawaban teknis (Fase 14 §28) — BELUM DIDESAIN (OQ-50): dibangun minimal dengan
   * token yang sama; label di sini menunggu desain, bukan sumber kebenaran visual.
   */
  composition: {
    optionsTitle: 'Opsi ukuran yang dipertimbangkan',
    optionsHint:
      'Semua kandidat yang dihitung — bukan hanya yang dipilih — supaya tradeoff-nya terlihat.',
    optionRecommended: 'DIREKOMENDASIKAN',
    optionAlternative: 'ALTERNATIF',
    optionStatus: {
      ok: 'MEMENUHI',
      too_fast: 'TERLALU CEPAT',
      too_slow: 'TERLALU LAMBAT',
      high_loss: 'KERUGIAN TINGGI',
      too_small: 'KAPASITAS KURANG',
    },
    readinessTitle: 'Kesiapan hasil',
    readinessLabel: {
      ready: 'SIAP',
      partial: 'SEBAGIAN',
      missing_data: 'DATA KURANG',
    },
    readinessMissing: 'Masih kurang:',
    readinessImprovable: 'Lebih akurat bila ada:',
    knownTitle: 'Data yang diketahui',
    assumedTitle: 'Parameter yang diasumsikan',
    calculationsTitle: 'Perhitungan',
    missingTitle: 'Data yang masih dibutuhkan',
  },

  matchStateLabel: {
    VERIFIED_SELECTED: 'DIPAKAI DI SOLUSI INI',
    SIZE_NEEDS_VALIDATION: 'UKURAN PERLU DIKONFIRMASI',
    INFORMATION_UNAVAILABLE: 'DATA BELUM LENGKAP',
  },
} as const;
