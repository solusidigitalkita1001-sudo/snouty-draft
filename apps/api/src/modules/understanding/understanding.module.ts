/**
 * Modul pemahaman pertanyaan (P16-11). Aturan proyek: pertanyaan pengguna tidak pernah
 * di-hardcode — contoh kalimat hidup di `data/understanding/`, kode hanya memegang label dan
 * perilakunya. Bergantung pada `ai` untuk penyandi teks; tidak menyentuh `context`.
 */
import { Module } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { LoggerService } from '../../shared/logging/logger.service.js';
import { AiModule } from '../ai/ai.module.js';
import { TEXT_ENCODER, type TextEncoder } from '../ai/domain/text-encoder.port.js';
import { UnderstandingService } from './application/understanding.service.js';
import { EntityLexicon } from './domain/vocabulary.js';
import {
  findDataDir,
  loadUnderstandingData,
  type UnderstandingData,
} from './infrastructure/catalog-files.js';
import { FileVectorCache } from './infrastructure/file-vector.cache.js';
import { HashedNgramEncoder } from './infrastructure/hashed-ngram.encoder.js';

export const UNDERSTANDING_DATA = Symbol('UNDERSTANDING_DATA');

const dataProvider = {
  provide: UNDERSTANDING_DATA,
  useFactory: (): UnderstandingData => {
    const dir = loadEnv().UNDERSTANDING_DATA_DIR ?? findDataDir();
    if (!dir) {
      throw new Error(
        'data/understanding tidak ditemukan — set UNDERSTANDING_DATA_DIR atau jalankan dari repo',
      );
    }
    return loadUnderstandingData(dir);
  },
};

const serviceProvider = {
  provide: UnderstandingService,
  inject: [UNDERSTANDING_DATA, TEXT_ENCODER, LoggerService],
  useFactory: (data: UnderstandingData, encoder: TextEncoder | null, logger: LoggerService) => {
    const env = loadEnv();
    // Pengembangan tanpa Ollama: penyandi cadangan supaya alur bisa diklik, sama syaratnya
    // dengan adapter AI palsu. Tidak pernah di produksi.
    const fallback =
      env.NODE_ENV === 'development' && process.env['SNOUTY_FAKE_AI'] === '1'
        ? new HashedNgramEncoder()
        : null;
    return new UnderstandingService(
      data.catalogs,
      new EntityLexicon(data.vocabulary),
      encoder ?? fallback,
      new FileVectorCache(env.UNDERSTANDING_CACHE_DIR),
      logger.child({ module: 'understanding' }),
    );
  },
};

@Module({
  imports: [AiModule],
  providers: [dataProvider, serviceProvider],
  exports: [UnderstandingService],
})
export class UnderstandingModule {}
