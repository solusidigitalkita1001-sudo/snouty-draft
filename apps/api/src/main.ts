import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import pino from 'pino';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { ApiErrorFilter } from './shared/http/api-error.filter.js';

const log = pino({ name: 'snouty-api' });

async function bootstrap(): Promise<void> {
  // Gagal keras di sini bila konfigurasi kurang, bukan nanti saat permintaan pertama.
  const env = loadEnv();

  const app = await NestFactory.create(AppModule, { logger: false });

  // `/api/v1` untuk seluruh API (docs/API_CONTRACTS.md §1). `/health` dikecualikan:
  // ia dipanggil pemeriksa infrastruktur yang tidak mengenal versi API kita, dan
  // memindahkannya akan memutus pemeriksaan yang sudah berjalan.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // Satu bentuk galat untuk seluruh API, dipasang sekali di sini supaya tidak ada
  // controller yang bisa mengarang bentuknya sendiri.
  app.useGlobalFilters(new ApiErrorFilter());

  app.enableShutdownHooks();
  await app.listen(env.PORT);

  log.info({ port: env.PORT, env: env.NODE_ENV }, 'SNOUTY API siap');
}

bootstrap().catch((err: unknown) => {
  log.error({ err }, 'API gagal start');
  process.exit(1);
});
