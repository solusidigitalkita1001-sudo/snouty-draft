import type { Logger } from 'pino';
import { ulid } from '../../../shared/ulid.js';
import {
  consultationFunnel,
  drainageDemand,
  productInterestTrend,
  projectPatterns,
  regionalDemand,
  scopeSignal,
  type AggregateResult,
  type ConsultationFunnel,
  type ScopeSignal,
} from '../domain/aggregate.js';
import {
  chatMarketEvent,
  type ChatEventTrigger,
  type ConsultationFacts,
} from '../domain/chat-event.js';
import type { MarketEvent } from '../domain/market-event.js';
import { mapDemand, type MapDemand } from '../domain/aggregate.js';
import type { Place } from '../domain/region.js';

export interface MarketEventStore {
  claim(conversationId: string): Promise<boolean>;
  facts(conversationId: string): Promise<ConsultationFacts>;
  insert(event: MarketEvent): Promise<void>;
  since(fromDay: string): Promise<readonly MarketEvent[]>;
}

export interface RegionLookup {
  placeOf(ip: string | undefined): Promise<Place>;
}

export interface MarketDashboard {
  readonly fromDay: string;
  readonly total: number;
  readonly regional: AggregateResult;
  readonly productInterest: AggregateResult;
  readonly projects: AggregateResult;
  readonly scope: ScopeSignal;
  readonly drainage: number;
  readonly funnel: ConsultationFunnel;
  readonly map: MapDemand;
}

/**
 * Event pasar dari konsultasi chat dan agregatnya (P26-07, docs/MARKET_INTELLIGENCE.md). Pencatatan
 * tidak pernah menahan atau menggagalkan permintaan pengguna: dipanggil di latar, galat hanya log.
 */
export class MarketEventService {
  constructor(
    private readonly store: MarketEventStore,
    private readonly regions: RegionLookup,
    private readonly log: Pick<Logger, 'warn'> | null = null,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Satu event per konsultasi: solusi pertama, atau serah ke tim teknis bila solusi tak pernah ada. */
  async record(conversationId: string, trigger: ChatEventTrigger, ip: string | undefined) {
    try {
      if (!(await this.store.claim(conversationId))) return;
      const [facts, place] = await Promise.all([
        this.store.facts(conversationId),
        this.regions.placeOf(ip),
      ]);
      await this.store.insert(
        chatMarketEvent({
          id: ulid(),
          at: this.clock().toISOString(),
          region: place.province,
          city: place.city,
          lat: place.lat,
          lng: place.lng,
          trigger,
          facts,
        }),
      );
    } catch (error) {
      this.log?.warn({ err: error, trigger }, 'event pasar tidak tercatat');
    }
  }

  /** Agregat dashboard pasar; ambang k-anonimitas diterapkan di fungsi agregat, bukan di layar. */
  async dashboard(days: number): Promise<MarketDashboard> {
    const from = new Date(this.clock().getTime() - days * 86_400_000).toISOString().slice(0, 10);
    const events = await this.store.since(from);
    return {
      fromDay: from,
      total: events.length,
      regional: regionalDemand(events),
      productInterest: productInterestTrend(events),
      projects: projectPatterns(events),
      scope: scopeSignal(events),
      drainage: drainageDemand(events),
      funnel: consultationFunnel(events),
      map: mapDemand(events),
    };
  }
}
