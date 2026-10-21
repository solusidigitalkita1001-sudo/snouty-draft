/**
 * Market intelligence (Fase 12, penulis + dashboard P26-07). Tidak diimpor rekomendasi, engineering,
 * atau context (pagar lint): wilayah tidak punya jalur ke rekomendasi. Rute penghasil event hanya
 * memasang penanda `@RecordsMarketEvent` dari `shared/market`.
 */
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { loadEnv } from '../../config/env.js';
import { DatabaseService } from '../../shared/database/database.service.js';
import { InternalRoleGuard } from '../../shared/http/internal-role.guard.js';
import { LoggerService } from '../../shared/logging/logger.service.js';
import { MarketEventService } from './application/market-event.service.js';
import { GeoIpLookup } from './infrastructure/geoip.js';
import { MysqlMarketEventStore } from './infrastructure/mysql-market-event.store.js';
import { InternalMarketController } from './presentation/internal-market.controller.js';
import { MarketEventInterceptor } from './presentation/market-event.interceptor.js';

const marketEventServiceProvider = {
  provide: MarketEventService,
  inject: [DatabaseService, LoggerService],
  useFactory: (database: DatabaseService, logger: LoggerService) => {
    const log = logger.child({ module: 'market' });
    return new MarketEventService(
      new MysqlMarketEventStore(database),
      new GeoIpLookup(loadEnv().GEOIP_DB_PATH, log),
      log,
    );
  },
};

@Module({
  controllers: [InternalMarketController],
  providers: [
    marketEventServiceProvider,
    InternalRoleGuard,
    { provide: APP_INTERCEPTOR, useClass: MarketEventInterceptor },
  ],
})
export class MarketIntelligenceModule {}
