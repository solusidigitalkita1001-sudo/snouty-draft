/**
 * `POST /conversations/:id/analyze` (SSE) dan `GET /recommendations/:id`.
 * docs/API_CONTRACTS.md §2, §3.
 *
 * Kepemilikan percakapan diperiksa di lapisan application (`ConversationService.find`),
 * bukan hanya lewat `WHERE` di repository (docs/SECURITY.md §4).
 */
import { Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AssistantStreamEvent } from '@snouty/shared-types';
import { z } from 'zod';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import { RequirementSnapshotStore } from '../../context/application/requirement-snapshot.store.js';
import { AnalysisService, CatalogUnavailableError } from '../application/analysis.service.js';
import { RECOMMENDATION_REPOSITORY } from '../domain/recommendation.repository.js';
import type { RecommendationRepository } from '../domain/recommendation.repository.js';
import { Inject } from '@nestjs/common';
import { assumptionCardFor } from '../../context/application/message-pipeline.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();

@Controller()
export class RecommendationController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly snapshots: RequirementSnapshotStore,
    private readonly analysis: AnalysisService,
    @Inject(RECOMMENDATION_REPOSITORY) private readonly repository: RecommendationRepository,
  ) {}

  @Post('conversations/:id/analyze')
  async analyze(
    @Param() params: unknown,
    @Req() req: PublicRequest,
    @Res() res: Response,
  ): Promise<void> {
    const id = parse(IdParam, params).id;
    const actor = actorOf(req);
    await this.conversations.find(id, actor);

    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache, no-transform');
    res.flushHeaders?.();

    const snapshot = await this.snapshots.current(id);
    if (!snapshot) {
      write(res, { type: 'error', code: 'VALIDATION_FAILED', retryable: false });
      res.end();
      return;
    }

    try {
      const assumptions = assumptionCardFor(snapshot.state).map((item) => ({
        text: item.reason,
        fieldPath: item.path,
        ...(item.ruleId !== undefined ? { ruleId: item.ruleId } : {}),
      }));
      const events = await this.analysis.run(
        id,
        snapshot.id,
        snapshot.state,
        assumptions,
        new Date().toISOString(),
      );
      for (const event of events) write(res, event);
    } catch (error) {
      // Katalog tidak tersedia adalah kegagalan yang jujur dan bisa dicoba lagi —
      // bukan alasan menampilkan solusi tanpa produk.
      const code =
        error instanceof CatalogUnavailableError ? 'CATALOG_UNAVAILABLE' : 'SERVICE_UNAVAILABLE';
      write(res, { type: 'error', code, retryable: true });
    }
    res.end();
  }

  /**
   * Topologi skema. **Tidak disimpan** — dibentuk ulang deterministik dari snapshot yang
   * tersimpan, jadi ia selalu konsisten dengan tabel sistem dan BOM yang lahir dari
   * sumber yang sama (docs/SCHEMATIC_ENGINE.md §1).
   */
  @Get('recommendations/:id/schematic')
  async schematic(@Param() params: unknown, @Req() req: PublicRequest): Promise<unknown> {
    const id = parse(IdParam, params).id;
    const recommendation = await this.repository.findById(id);
    if (!recommendation) return { error: { code: 'NOT_FOUND' } };

    await this.conversations.find(recommendation.conversationId, actorOf(req));

    const snapshot = await this.snapshots.current(recommendation.conversationId);
    if (!snapshot) return { error: { code: 'NOT_FOUND' } };

    return this.analysis.schematicForRecommendation(
      snapshot.state,
      recommendation.catalogVersionId,
      recommendation.createdAt,
    );
  }

  @Get('recommendations/:id')
  async byId(@Param() params: unknown, @Req() req: PublicRequest): Promise<unknown> {
    const id = parse(IdParam, params).id;
    const recommendation = await this.repository.findById(id);
    if (!recommendation) return { error: { code: 'NOT_FOUND' } };

    // Kepemilikan diperiksa lewat percakapannya — rekomendasi tidak punya pemilik
    // sendiri, dan memeriksanya di sini mencegah id yang ditebak membocorkan solusi.
    await this.conversations.find(recommendation.conversationId, actorOf(req));
    return recommendation;
  }
}

function write(res: Response, event: AssistantStreamEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
