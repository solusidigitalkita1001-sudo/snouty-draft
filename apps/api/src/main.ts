import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import pino from 'pino';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { configProblems } from './config/startup-config.js';
import { ApiErrorFilter } from './shared/http/api-error.filter.js';
import { trustReverseProxy } from './shared/http/trust-proxy.js';
import { DatabaseService } from './shared/database/database.service.js';

const log = pino({ name: 'snouty-api' });

async function bootstrap(): Promise<void> {
  // Gagal keras di sini bila konfigurasi kurang, bukan nanti saat permintaan pertama.
  const env = loadEnv();

  // Konfigurasi yang membuat fitur tampil selesai tetapi gagal dipakai (smoke test 13 Nov 2026,
  // temuan 11): di produksi itu alasan berhenti, bukan alasan mencatat peringatan.
  const problems = configProblems(env);
  if (problems.length > 0) {
    if (env.NODE_ENV === 'production') {
      log.error({ problems }, 'konfigurasi kurang');
      process.exit(1);
    }
    log.warn({ problems }, 'konfigurasi kurang');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });

  // Satu reverse proxy (nginx) di depan — IP klien dari X-Forwarded-For (shared/http/trust-proxy.ts).
  trustReverseProxy(app);

  // `/api/v1` untuk seluruh API (docs/API_CONTRACTS.md §1). `/health` dikecualikan:
  // ia dipanggil pemeriksa infrastruktur yang tidak mengenal versi API kita, dan
  // memindahkannya akan memutus pemeriksaan yang sudah berjalan.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // Satu bentuk galat untuk seluruh API, dipasang sekali di sini supaya tidak ada
  // controller yang bisa mengarang bentuknya sendiri.
  app.useGlobalFilters(new ApiErrorFilter());

  // Zona waktu sesi MySQL harus UTC sebelum permintaan pertama (smoke test 13 Nov 2026, temuan 5).
  // Database yang belum bisa dihubungi bukan alasan menolak start — `/health` yang melaporkannya —
  // tetapi database yang bisa dihubungi dengan sesi bukan UTC adalah alasan berhenti: di atasnya
  // register dan login gagal satu per satu dengan sebab yang tidak terlihat.
  const database = app.get(DatabaseService);
  try {
    await database.assertUtcSession();
  } catch (err: unknown) {
    if (await database.ping().catch(() => false)) {
      log.error({ err }, 'zona waktu sesi MySQL bukan UTC');
      await app.close();
      process.exit(1);
    }
    log.warn({ err }, 'zona waktu sesi MySQL belum bisa diperiksa: database belum terjangkau');
  }
  app.enableShutdownHooks();
  await app.listen(env.PORT);

  log.info({ port: env.PORT, env: env.NODE_ENV }, 'SNOUTY API siap');
}

bootstrap().catch((err: unknown) => {
  log.error({ err }, 'API gagal start');
  process.exit(1);
});
