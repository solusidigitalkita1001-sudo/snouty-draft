import { Injectable } from '@nestjs/common';
import pino, { type Logger } from 'pino';
import { loadEnv } from '../../config/env.js';

/**
 * Satu logger Pino per proses, di-inject seperti pool dan klien Redis.
 *
 * Yang **selalu** dicatat: correlation ID, aktor, aksi, hasil, latensi.
 * Yang **tidak pernah**: password, token, kredensial, isi prompt, data pribadi, isi
 * unggahan (docs/SECURITY.md §11). Aturan itu tidak bisa ditegakkan oleh tipe, jadi
 * ia ditegakkan di tempat pemanggilan — dan setiap pemanggil yang mendekati batas
 * itu punya tes yang memeriksanya.
 */
@Injectable()
export class LoggerService {
  readonly logger: Logger;

  constructor() {
    const env = loadEnv();
    this.logger = pino({
      name: 'snouty-api',
      // Di pengembangan, `debug` membantu; di produksi ia menenggelamkan yang penting.
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    });
  }

  child(bindings: Record<string, unknown>): Logger {
    return this.logger.child(bindings);
  }
}
