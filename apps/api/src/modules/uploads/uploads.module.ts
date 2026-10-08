/**
 * Modul lampiran denah (P13-06). Satu service + satu repository, seperti yang diizinkan
 * docs/ARCHITECTURE.md §5 untuk modul tanpa aturan domain sendiri.
 */
import { Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { LoggerService } from '../../shared/logging/logger.service.js';
import { RateLimiter } from '../../shared/rate-limit/rate-limiter.js';
import { RedisService } from '../../shared/redis/redis.service.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { ConversationService } from '../conversation/application/conversation.service.js';
import { UploadsService } from './application/uploads.service.js';
import { UPLOAD_REPOSITORY, type UploadRepository } from './domain/upload.repository.js';
import { LocalFileStore } from './infrastructure/file-store.js';
import { uploadRepositoryProvider } from './infrastructure/mysql-upload.repository.js';
import { UploadsController } from './presentation/uploads.controller.js';

/** Pembersihan retensi berjalan berkala; enam jam cukup untuk masa simpan dalam hitungan hari. */
const PURGE_INTERVAL_MS = 6 * 3_600_000;

const uploadsServiceProvider = {
  provide: UploadsService,
  inject: [UPLOAD_REPOSITORY, ConversationService, RedisService],
  useFactory: (repo: UploadRepository, conversations: ConversationService, redis: RedisService) => {
    const env = loadEnv();
    return new UploadsService(
      repo,
      env.STORAGE_PATH ? new LocalFileStore(env.STORAGE_PATH) : null,
      conversations,
      new RateLimiter(redis),
      { maxBytes: env.UPLOAD_MAX_MB * 1024 * 1024, retentionDays: env.UPLOAD_RETENTION_DAYS },
    );
  },
};

@Module({
  imports: [ConversationModule],
  controllers: [UploadsController],
  providers: [uploadRepositoryProvider, uploadsServiceProvider],
  exports: [uploadsServiceProvider],
})
export class UploadsModule implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly uploads: UploadsService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    const log = this.logger.child({ module: 'uploads' });
    const purge = () =>
      void this.uploads
        .purgeExpired()
        .then((n) => n > 0 && log.info({ removed: n }, 'lampiran kedaluwarsa dihapus'))
        .catch((err: unknown) => log.warn({ err }, 'pembersihan lampiran gagal'));
    purge();
    this.timer = setInterval(purge, PURGE_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
