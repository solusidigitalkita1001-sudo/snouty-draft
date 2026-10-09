/**
 * `POST /conversations/:id/analyze` (SSE) dan `GET /recommendations/:id`.
 * docs/API_CONTRACTS.md §2, §3.
 *
 * Kepemilikan percakapan diperiksa di lapisan application (`ConversationService.find`),
 * bukan hanya lewat `WHERE` di repository (docs/SECURITY.md §4).
 */
import { Body, Controller, Get, Optional, Param, Post, Put, Req, Res } from '@nestjs/common';
import { CaseInputInvalidError } from '@snouty/engineering';
import type { Response } from 'express';
import type { AssistantStreamEvent } from '@snouty/shared-types';
import { z } from 'zod';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import { RequirementSnapshotStore } from '../../context/application/requirement-snapshot.store.js';
import {
  AnalysisService,
  CatalogUnavailableError,
  overrideAssumption,
} from '../application/analysis.service.js';
import { RECOMMENDATION_REPOSITORY } from '../domain/recommendation.repository.js';
import type { RecommendationRepository } from '../domain/recommendation.repository.js';
import { Inject } from '@nestjs/common';
import { assumptionCardFor } from '../../context/application/message-pipeline.js';
import { sseWriter } from '../../../shared/sse/event-stream.js';
import { LoggerService } from '../../../shared/logging/logger.service.js';
import { streamStageClock } from '../../../shared/logging/stage-timer.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
/** `value: null` = kembalikan ke nilai baku asumsi. */
const AssumptionBody = z
  .object({ assumptionId: z.string().min(1).max(64), value: z.number().nullable() })
  .strict();

@Controller()
export class RecommendationController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly snapshots: RequirementSnapshotStore,
    private readonly analysis: AnalysisService,
    @Inject(RECOMMENDATION_REPOSITORY) private readonly repository: RecommendationRepository,
    @Optional() private readonly log?: LoggerService,
  ) {}

  @Post('conversations/:id/analyze')
  async analyze(
    @Param() params: unknown,
    @Req() req: PublicRequest,
    @Res() res: Response,
  ): Promise<void> {
    const id = parse(IdParam, params).id;
    const actor = actorOf(req);
    const conversation = await this.conversations.find(id, actor);

    /**
     * Snapshot dibaca dan analisis dijalankan **sebelum** header ditulis, alasan yang sama
     * seperti di `message.controller`: galat setelah header terkirim menjadi
     * `ERR_EMPTY_RESPONSE` yang tidak bisa didiagnosis siapa pun.
     */
    const snapshot = await this.snapshots.current(id);

    // Event tahap mengalir saat terjadi (P14-07): header SSE baru ditulis pada event pertama,
    // jadi galat sebelum itu tetap respons JSON berstatus benar; galat sesudahnya menjadi
    // event `error` yang terbaca — bukan ERR_EMPTY_RESPONSE.
    const writer = sseWriter(res);
    // Waktu per tahap analisis (engine, katalog, penyusunan) dari event yang memang dialirkan.
    const clock = streamStageClock();
    const emit = (event: AssistantStreamEvent) => {
      clock.observe(event);
      writer.emit(event);
    };
    let events: readonly AssistantStreamEvent[];
    if (!snapshot) {
      events = [{ type: 'error', code: 'VALIDATION_FAILED', retryable: false }];
    } else {
      try {
        const assumptions = assumptionCardFor(snapshot.state, conversation.language).map(
          (item) => ({
            text: item.reason,
            fieldPath: item.path,
            ...(item.ruleId !== undefined ? { ruleId: item.ruleId } : {}),
          }),
        );
        events = await this.analysis.run(
          id,
          snapshot.id,
          snapshot.state,
          assumptions,
          new Date().toISOString(),
          emit,
          conversation.language,
        );
      } catch (error) {
        // Katalog tidak tersedia adalah kegagalan jujur dan bisa dicoba lagi — bukan
        // alasan menampilkan solusi tanpa produk.
        // Masukan kasus yang bertentangan bukan gangguan layanan: mengulang tidak akan menolong,
        // pengguna harus memperbaiki datanya (pertanyaannya sudah diajukan di chat).
        const invalid = error instanceof CaseInputInvalidError;
        const code = invalid
          ? 'VALIDATION_FAILED'
          : error instanceof CatalogUnavailableError
            ? 'CATALOG_UNAVAILABLE'
            : 'SERVICE_UNAVAILABLE';
        events = [{ type: 'error', code, retryable: !invalid }];
        if (writer.started()) {
          writer.emit(events[0]!);
          res.end();
          return;
        }
      }
    }

    for (const event of events.slice(writer.written())) emit(event);
    res.end();
    this.log?.logger.info({ conversationId: id, ms: clock.report() }, 'analisis');
  }

  /**
   * Topologi skema. **Tidak disimpan** — dibentuk ulang deterministik dari snapshot yang
   * tersimpan, jadi ia selalu konsisten dengan tabel sistem dan BOM yang lahir dari
   * sumber yang sama (docs/SCHEMATIC_ENGINE.md §1).
   */
  /**
   * "Perbaiki asumsi ini" pada kasus teknis: simpan nilai pengganti satu asumsi registry di kasus.
   * Nilainya diuji dengan hitung coba dulu; web lalu menjalankan Susun rekomendasi ulang.
   */
  @Put('conversations/:id/assumptions')
  async overrideAssumption(
    @Param() params: unknown,
    @Body() body: unknown,
    @Req() req: PublicRequest,
  ): Promise<unknown> {
    const id = parse(IdParam, params).id;
    const input = parse(AssumptionBody, body);
    const conversation = await this.conversations.find(id, actorOf(req));
    const snapshot = await this.snapshots.current(id);
    if (!snapshot) throw new RequestValidationError(['assumptionId']);
    const next = overrideAssumption(
      snapshot.state,
      input.assumptionId,
      input.value,
      conversation.language,
    );
    const saved = await this.snapshots.append(id, next, 'user_edit');
    return { state: saved.state };
  }

  @Get('recommendations/:id/schematic')
  async schematic(@Param() params: unknown, @Req() req: PublicRequest): Promise<unknown> {
    const id = parse(IdParam, params).id;
    const recommendation = await this.repository.findById(id);
    if (!recommendation) return { error: { code: 'NOT_FOUND' } };

    const conversation = await this.conversations.find(recommendation.conversationId, actorOf(req));

    const snapshot = await this.snapshots.current(recommendation.conversationId);
    if (!snapshot) return { error: { code: 'NOT_FOUND' } };

    // Kasus teknis dan irigasi → skema aliran (rel vertikal); bangunan → skema lantai per lantai.
    return this.analysis.schematicForRecommendation(
      snapshot.state,
      recommendation.catalogVersionId,
      recommendation.createdAt,
      conversation.language,
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

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
