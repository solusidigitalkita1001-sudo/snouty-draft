/**
 * Modul AI. docs/ARCHITECTURE.md §7 · docs/AI_BEHAVIOR.md.
 *
 * `AI_SERVICE` DIGERBANG keberadaan `OPENROUTER_API_KEY` dan ketiga ID model:
 * tanpa konfigurasi lengkap, provider-nya `null` dan pemanggil (MessageService)
 * mengalirkan `LLM_UNAVAILABLE` alih-alih memanggil model yang tak ada. Itulah yang
 * membuat seluruh Context Engine bisa dijalankan tanpa kunci maupun biaya.
 */
import { Module } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { DatabaseService } from '../../shared/database/database.service.js';
import { AI_SERVICE } from './domain/ai.port.js';
import { LLM_CALL_RECORDER } from './domain/llm-call.recorder.js';
import { LLM_TRANSPORT, type LlmTransport } from './domain/llm-transport.port.js';
import { MysqlLlmCallRecorder } from './infrastructure/mysql-llm-call.recorder.js';
import { OpenRouterTransport } from './infrastructure/openrouter-transport.js';
import { OpenRouterAiService } from './application/openrouter-ai.service.js';

const transportProvider = { provide: LLM_TRANSPORT, useClass: OpenRouterTransport };

const recorderProvider = {
  provide: LLM_CALL_RECORDER,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService) => new MysqlLlmCallRecorder(database),
};

const aiServiceProvider = {
  provide: AI_SERVICE,
  inject: [LLM_TRANSPORT, LLM_CALL_RECORDER],
  useFactory: (
    transport: LlmTransport,
    recorder: MysqlLlmCallRecorder,
  ): OpenRouterAiService | null => {
    const env = loadEnv();
    const configured =
      env.OPENROUTER_API_KEY &&
      env.LLM_MODEL_FAST &&
      env.LLM_MODEL_BALANCED &&
      env.LLM_MODEL_STRONG;
    return configured ? new OpenRouterAiService(transport, recorder) : null;
  },
};

@Module({
  providers: [transportProvider, recorderProvider, aiServiceProvider],
  exports: [AI_SERVICE],
})
export class AiModule {}
