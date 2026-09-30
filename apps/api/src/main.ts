import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import pino from 'pino';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

const log = pino({ name: 'snouty-api' });

async function bootstrap(): Promise<void> {
  // Gagal keras di sini bila konfigurasi kurang, bukan nanti saat permintaan pertama.
  const env = loadEnv();

  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableShutdownHooks();
  await app.listen(env.PORT);

  log.info({ port: env.PORT, env: env.NODE_ENV }, 'SNOUTY API siap');
}

bootstrap().catch((err: unknown) => {
  log.error({ err }, 'API gagal start');
  process.exit(1);
});
