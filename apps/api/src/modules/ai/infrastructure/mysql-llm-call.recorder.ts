import { Injectable } from '@nestjs/common';
import { llmCalls } from '../../../infrastructure/mysql/schema/ops.js';
import { type QueryRunner } from '../../../shared/database/database.service.js';
import { ulid } from '../../../shared/ulid.js';
import type { LlmCallRecord, LlmCallRecorder } from '../domain/llm-call.recorder.js';

@Injectable()
export class MysqlLlmCallRecorder implements LlmCallRecorder {
  constructor(private readonly database: QueryRunner) {}

  async record(record: LlmCallRecord): Promise<void> {
    await this.database.db.insert(llmCalls).values({
      id: ulid(),
      correlationId: record.correlationId,
      task: record.task,
      tier: record.tier,
      model: record.model,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      costUsd: record.costUsd.toFixed(6),
      latencyMs: record.latencyMs,
      outcome: record.outcome,
    });
  }
}
