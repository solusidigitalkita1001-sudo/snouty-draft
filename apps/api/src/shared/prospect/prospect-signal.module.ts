import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ProspectSignalInterceptor } from './prospect-signal.interceptor.js';

/** Sinyal tahap 5A untuk seluruh endpoint ber-`@RecordsSignal` (shared/prospect/prospect-signal.ts). */
@Global()
@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: ProspectSignalInterceptor }],
})
export class ProspectSignalModule {}
