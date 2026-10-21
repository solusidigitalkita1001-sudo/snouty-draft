/**
 * Event pasar dari satu konsultasi chat (P26-07, docs/MARKET_INTELLIGENCE.md §3–§4). Fungsi murni:
 * fakta yang sudah dibaca DI DALAM konteks percakapan masuk, event tanpa identitas keluar. Masukannya
 * pun tidak membawa id percakapan atau pengguna — yang tidak diterima tidak bisa bocor.
 */
import { projectScaleOf } from '../../prospect/domain/prospect-stage.js';
import {
  dayOf,
  productInterestKey,
  type MarketEvent,
  type MarketInstallationType,
  type ProjectScale,
} from './market-event.js';

export type ChatEventTrigger = 'solution' | 'technical';

export interface ConsultationFacts {
  readonly buildingType: string | null;
  readonly floors: number | null;
  readonly outletCount: number | null;
  /** `clean_water` | `drainage` | `both` dari kebutuhan. */
  readonly installationType: string | null;
  readonly caseId: string | null;
  readonly products: readonly { readonly family: string | null; readonly size: string | null }[];
  /** Pengguna menanyakan harga atau minta dihubungi sales dalam konsultasi ini. */
  readonly quotationIntent: boolean;
}

const INSTALLATION: Readonly<Record<string, MarketInstallationType>> = {
  clean_water: 'air_bersih',
  drainage: 'pembuangan',
  both: 'keduanya',
};

/** Skala pasar dari aturan skala proyek yang sama dengan prospek: rumah/gedung/kawasan. */
const MARKET_SCALE = {
  house: 'kecil',
  building: 'sedang',
  district: 'besar',
} as const satisfies Record<string, ProjectScale>;

export function chatMarketEvent(input: {
  readonly id: string;
  readonly at: string;
  readonly region: string | null;
  readonly trigger: ChatEventTrigger;
  readonly facts: ConsultationFacts;
}): MarketEvent {
  const { facts } = input;
  const known = facts.buildingType !== null || facts.caseId !== null;
  const interest = new Set<string>();
  for (const product of facts.products) {
    if (product.family && product.size)
      interest.add(productInterestKey(product.family, product.size));
  }
  return {
    id: input.id,
    source: 'chat',
    occurredOn: dayOf(input.at),
    region: input.region,
    buildingType: facts.buildingType ?? facts.caseId,
    projectScale: known
      ? MARKET_SCALE[projectScaleOf({ useCase: facts.caseId, buildingType: facts.buildingType })]
      : null,
    installationType:
      facts.installationType === null ? null : (INSTALLATION[facts.installationType] ?? null),
    outletCount: facts.outletCount,
    floors: facts.floors,
    productInterest: [...interest],
    quotationIntent: facts.quotationIntent,
    reachedSolution: input.trigger === 'solution',
    routedToTechnical: input.trigger === 'technical',
  };
}
