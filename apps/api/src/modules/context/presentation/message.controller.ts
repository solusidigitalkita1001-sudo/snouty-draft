/**
 * `POST /conversations/:id/messages` — giliran chat, balasan SSE.
 * docs/API_CONTRACTS.md §2, §3.
 *
 * SSE bukan `@Sse()` Nest (yang berorientasi GET + Observable): giliran ini punya
 * body (pesan), jadi responsnya ditulis manual sebagai `event:`/`data:`. Kepemilikan
 * percakapan diperiksa di service (lapis application).
 */
import { Body, Controller, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AssistantStreamEvent, RequirementState } from '@snouty/shared-types';
import { z } from 'zod';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { RateLimitedError, RequestValidationError } from '../../../shared/http/api-errors.js';
import { limitFor } from '../../policy/rate-limits.js';
import { RateLimiter } from '../../../shared/rate-limit/rate-limiter.js';
import { MessageService } from '../application/message.service.js';
import { sseWriter } from '../../../shared/sse/event-stream.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const MessageDto = z.object({ text: z.string().trim().min(1).max(4_000) }).strict();
/** Hanya field yang punya templat pertanyaan; labelnya divalidasi domain, bukan di sini. */
const ClarificationDto = z
  .object({
    answers: z
      .array(
        z
          .object({
            id: z.enum([
              'water.source',
              'water.installationType',
              'building.floors',
              'fixtures.bathrooms',
              // Jalur irigasi (OQ-47) — labelnya divalidasi domain (`irrigationAnswerValue`).
              'irrigation.source',
              'irrigation.areaHa',
              'irrigation.method',
              'irrigation.distance',
              'irrigation.elevation',
              'irrigation.pump',
            ]),
            option: z.string().trim().min(1).max(40),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();

/**
 * Edit inline panel kanan — hanya tujuh field yang tampil di panel, dengan nilai yang
 * persis sama batasnya dengan skema ekstraksi. Tidak ada field bebas: path di luar
 * daftar ini ditolak, bukan diteruskan ke merger.
 */
const count = (max: number) => z.number().int().min(0).max(max);
const EditDto = z
  .object({
    edits: z
      .array(
        z.union([
          z
            .object({
              path: z.literal('building.type'),
              value: z.enum(['residential', 'boarding_house', 'light_commercial', 'industrial']),
            })
            .strict(),
          z
            .object({ path: z.literal('building.floors'), value: z.number().int().min(1).max(50) })
            .strict(),
          z
            .object({
              path: z.enum(['fixtures.bathrooms', 'fixtures.basins']),
              value: count(200),
            })
            .strict(),
          z.object({ path: z.literal('fixtures.kitchens'), value: count(100) }).strict(),
          z
            .object({
              path: z.literal('water.source'),
              value: z.enum(['rooftop_tank', 'ground_tank', 'pump', 'municipal']),
            })
            .strict(),
          z
            .object({
              path: z.literal('water.installationType'),
              value: z.enum(['clean_water', 'drainage', 'both']),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(7),
  })
  .strict();

@Controller('conversations')
export class MessageController {
  constructor(
    private readonly messages: MessageService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  /**
   * `GET /conversations/:id/requirement` (docs/API_CONTRACTS.md §3) — state kebutuhan
   * terkini, dipakai web untuk mengisi ulang panel saat riwayat dibuka kembali.
   * `{ state: null }` untuk percakapan yang belum punya satu pun snapshot.
   */
  @Get(':id/requirement')
  async requirement(
    @Param() params: unknown,
    @Req() req: PublicRequest,
  ): Promise<{ state: RequirementState | null }> {
    const id = parse(IdParam, params).id;
    return { state: await this.messages.requirement(id, actorOf(req)) };
  }

  /**
   * `POST /conversations/:id/requirement/clarification` — jawaban kartu klarifikasi, semua
   * sekaligus, nol LLM. "Lewati dan gunakan asumsi standar" = setiap jawaban "Belum tahu".
   */
  @Post(':id/requirement/clarification')
  async clarify(@Param() params: unknown, @Body() body: unknown, @Req() req: PublicRequest) {
    const id = parse(IdParam, params).id;
    const { answers } = parse(ClarificationDto, body);
    return this.messages.answerClarification(id, actorOf(req), answers, new Date().toISOString());
  }

  /** `PATCH /conversations/:id/requirement` — edit inline panel kanan, nol LLM. */
  @Patch(':id/requirement')
  async edit(
    @Param() params: unknown,
    @Body() body: unknown,
    @Req() req: PublicRequest,
  ): Promise<{ state: RequirementState }> {
    const id = parse(IdParam, params).id;
    const { edits } = parse(EditDto, body);
    const state = await this.messages.edit(id, actorOf(req), edits, new Date().toISOString());
    return { state };
  }

  @Post(':id/messages')
  async send(
    @Param() params: unknown,
    @Body() body: unknown,
    @Req() req: PublicRequest,
    @Res() res: Response,
  ): Promise<void> {
    const id = parse(IdParam, params).id;
    const { text } = parse(MessageDto, body);
    const actor = actorOf(req);

    // Batas pesan per tier (docs/POLICY.md §10). Diperiksa SEBELUM header SSE ditulis:
    // begitu respons menjadi stream, satu-satunya cara melaporkan penolakan adalah event
    // `error` — dan kode status 429 yang jujur lebih berguna bagi klien.
    const limit = limitFor(actor.tier, 'messages_per_hour');
    if (limit) {
      const verdict = await this.rateLimiter.consume(
        'messages',
        `${actor.kind}:${actor.id}`,
        limit,
      );
      if (!verdict.allowed) {
        throw new RateLimitedError(verdict.retryAfterSec);
      }
    }

    /**
     * Event mengalir saat terjadi (P14-07), tetapi header SSE baru ditulis pada event
     * PERTAMA. Dua hal yang dijaga sekaligus:
     *
     *   - Galat sebelum event pertama (kepemilikan, validasi, model tidak terjangkau saat
     *     start) tetap respons JSON berstatus benar — filter galat masih bisa menulisnya.
     *     Dulu header di-flush lebih dulu dan setiap galat sesudahnya menjadi
     *     `ERR_EMPTY_RESPONSE` tanpa petunjuk; itu yang dihindari di sini.
     *   - Galat setelah event pertama dilaporkan sebagai event `error` yang terbaca,
     *     bukan koneksi yang putus tanpa isi.
     *
     * Di CPU satu giliran kebutuhan 20–60 detik; tanpa aliran ini "UNDERSTANDING aktif"
     * baru terlihat bersamaan dengan jawabannya.
     */
    const now = new Date().toISOString();
    const writer = sseWriter(res);
    let events: readonly AssistantStreamEvent[];
    try {
      events = await this.messages.handle(id, actor, text, now, writer.emit);
    } catch (error) {
      if (!writer.started()) throw error;
      writer.emit({ type: 'error', code: 'SERVICE_UNAVAILABLE', retryable: true });
      res.end();
      return;
    }

    for (const event of events.slice(writer.written())) writer.emit(event);
    res.end();
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
