/**
 * Penanda rute yang melahirkan event pasar (P26-07): solusi selesai dihitung, atau kasus diserahkan
 * ke tim teknis. Deklaratif di endpoint; dicatat interceptor milik modul market-intelligence. Modul
 * rekomendasi hanya memasang penanda ini — ia tidak pernah mengimpor market-intelligence, jadi tidak
 * ada jalur data dari wilayah ke rekomendasi (docs/MARKET_INTELLIGENCE.md §6).
 */
import { SetMetadata } from '@nestjs/common';

export interface MarketSignalSpec {
  readonly trigger: 'solution' | 'technical';
  /** Parameter rute berisi id percakapan. */
  readonly param: string;
}

export const MARKET_SIGNAL = 'snouty:market-signal';

export const RecordsMarketEvent = (spec: MarketSignalSpec) => SetMetadata(MARKET_SIGNAL, spec);
