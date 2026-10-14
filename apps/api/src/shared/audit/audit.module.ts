import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit.interceptor.js';

/** Jejak audit tindakan pengguna untuk seluruh endpoint ber-`@Audited` (shared/audit/audited.ts). */
@Global()
@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AuditModule {}
