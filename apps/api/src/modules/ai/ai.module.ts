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
import { DevDeterministicAiService } from './infrastructure/dev-deterministic-ai.service.js';
import { TEXT_ENCODER } from './domain/text-encoder.port.js';
import { OpenAiEmbeddingEncoder } from './infrastructure/openai-embedding.encoder.js';

const transportProvider = { provide: LLM_TRANSPORT, useClass: OpenRouterTransport };

/**
 * Penyandi teks untuk modul `understanding`. Digerbang `LLM_MODEL_EMBEDDING` saja — Ollama tidak
 * butuh kunci, dan kunci yang kosong tidak boleh diam-diam mematikan pemahaman (tinjauan
 * 2026-10-08). Tanpa model: `null`, dan pemahaman jatuh ke model generatif (lambat, tetapi jujur).
 */
const textEncoderProvider = {
  provide: TEXT_ENCODER,
  useFactory: (): OpenAiEmbeddingEncoder | null => {
    const env = loadEnv();
    return env.LLM_MODEL_EMBEDDING ? new OpenAiEmbeddingEncoder(env.LLM_MODEL_EMBEDDING) : null;
  },
};

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
  ): OpenRouterAiService | DevDeterministicAiService | null => {
    const env = loadEnv();
    const configured =
      env.OPENROUTER_API_KEY &&
      env.LLM_MODEL_FAST &&
      env.LLM_MODEL_BALANCED &&
      env.LLM_MODEL_STRONG;

    // Adapter sungguhan SELALU menang bila kuncinya ada — adapter pengembangan tidak
    // pernah bisa menggantikan model yang sudah dikonfigurasi.
    if (configured) return new OpenRouterAiService(transport, recorder);

    /**
     * Ekstraktor deterministik khusus pengembangan: dua syarat, bukan satu. `NODE_ENV`
     * saja terlalu mudah salah set, dan konsekuensi adapter palsu yang aktif di produksi
     * adalah rekomendasi yang lahir dari regex.
     *
     * Tanpa keduanya, `AI_SERVICE` tetap `null` dan pipeline mengalirkan `LLM_UNAVAILABLE`
     * — jujur, dan tidak mengarang apa pun.
     */
    if (env.NODE_ENV === 'development' && process.env['SNOUTY_FAKE_AI'] === '1') {
      return new DevDeterministicAiService();
    }

    return null;
  },
};

@Module({
  providers: [transportProvider, recorderProvider, aiServiceProvider, textEncoderProvider],
  exports: [AI_SERVICE, TEXT_ENCODER],
})
export class AiModule {}
