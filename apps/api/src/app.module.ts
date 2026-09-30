import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';

/**
 * Skeleton — belum ada fitur. Modul domain menyusul mulai Fase 1
 * (docs/ARCHITECTURE.md §6).
 */
@Module({
  imports: [DatabaseModule, HealthModule],
})
export class AppModule {}
