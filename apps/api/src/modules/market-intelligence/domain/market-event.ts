/**
 * Event market intelligence. docs/MARKET_INTELLIGENCE.md §3. **Fungsi murni.**
 *
 * Bentuk tipe ini adalah penegakannya: tidak ada field untuk `userId`,
 * `guestSessionId`, `conversationId`, `emailId`, nama, alamat, nomor telepon, atau **teks
 * bebas apa pun**. Yang tidak bisa ditulis tidak bisa bocor.
 *
 * Teks bebas sengaja dilarang: satu kalimat mentah dari percakapan bisa memuat nama atau
 * detail yang membuat orang dapat dikenali, dan begitu masuk ke tabel agregat ia sulit
 * ditarik kembali.
 *
 * `occurredOn` presisi **hari**, bukan detik — presisi detik ditambah wilayah kecil adalah
 * kombinasi yang membuat identifikasi ulang jauh lebih mudah.
 */

export type MarketEventSource = 'chat' | 'email';
export type ProjectScale = 'kecil' | 'sedang' | 'besar';
export type MarketInstallationType = 'air_bersih' | 'pembuangan' | 'keduanya';

export interface MarketEvent {
  readonly id: string;
  readonly source: MarketEventSource;
  /** `YYYY-MM-DD`. */
  readonly occurredOn: string;
  /** Kota/kabupaten saja, mis. "Bekasi". */
  readonly region: string | null;
  readonly buildingType: string | null;
  readonly projectScale: ProjectScale | null;
  readonly installationType: MarketInstallationType | null;
  readonly outletCount: number | null;
  readonly floors: number | null;
  /** Kunci keluarga+ukuran, mis. `PVC AW|1"` — bukan SKU. */
  readonly productInterest: readonly string[];
  readonly quotationIntent: boolean;
  readonly reachedSolution: boolean;
  readonly routedToTechnical: boolean;
}

/** Membulatkan stempel waktu ISO ke hari. Satu-satunya cara `occurredOn` dibentuk. */
export function dayOf(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

/**
 * Kunci minat produk: keluarga + ukuran, bukan SKU. Minat pasar adalah "orang mencari PVC
 * AW 1 inci", bukan "orang membeli SKU-00123" — dan memakai SKU akan mengubah tabel ini
 * menjadi riwayat produk yang lebih mudah dihubungkan kembali ke satu konsultasi.
 */
export function productInterestKey(family: string, size: string): string {
  return `${family}|${size}`;
}
