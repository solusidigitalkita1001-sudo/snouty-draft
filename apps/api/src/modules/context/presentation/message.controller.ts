/**
 * `POST /conversations/:id/messages` — giliran chat, balasan SSE.
 * docs/API_CONTRACTS.md §2, §3.
 *
 * SSE bukan `@Sse()` Nest (yang berorientasi GET + Observable): giliran ini punya
 * body (pesan), jadi responsnya ditulis manual sebagai `event:`/`data:`. Kepemilikan
 * percakapan diperiksa di service (lapis application).
 */
import {
  Body,
  Controller,
  Get,
  Inject,
  Optional,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AssistantStreamEvent, RequirementState } from '@snouty/shared-types';
import { z } from 'zod';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { RateLimitedError, RequestValidationError } from '../../../shared/http/api-errors.js';
import { limitFor } from '../../policy/rate-limits.js';
import { RateLimiter } from '../../../shared/rate-limit/rate-limiter.js';
import { MessageService } from '../application/message.service.js';
import { isClarificationAnswerId, MAX_ANSWERS_PER_CARD } from '../domain/clarification.js';
import { isOutlierAnswerId } from '../domain/plausibility.js';
import { EditDto } from '../domain/requirement-edit.js';
import { HOUSE_EXAMPLES, type HouseExample } from '../domain/house-example.js';
import { sseWriter } from '../../../shared/sse/event-stream.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const ExampleParam = z
  .object({ id: z.string().length(26), exampleId: z.string().regex(/^[a-z0-9_]{2,40}$/) })
  .strict();
/**
 * `mode` (catatan pemilik 2026-10-09 "mode hemat / high quality"): hemat = jawaban langsung dari
 * DATA, instan; kualitas = model merangkai jawaban pengetahuan untuk pertanyaan itu (±20 detik).
 */
const MessageDto = z
  .object({
    text: z.string().trim().min(1).max(4_000),
    mode: z.enum(['hemat', 'kualitas']).optional(),
  })
  .strict();
/** Hanya field yang punya templat pertanyaan; labelnya divalidasi domain, bukan di sini. */
const ClarificationDto = z
  .object({
    answers: z
      .array(
        z
          .object({
            // Field inti bangunan, field irigasi (OQ-47), atau kunci parameter kasus teknis
            // (Fase 14) — satu daftar di domain (`isClarificationAnswerId`), supaya kartu yang
            // dikirim API selalu bisa dijawab lewat API (bug 2026-10-07: kartu teknis → 400).
            id: z
              .string()
              .trim()
              .min(1)
              .max(64)
              .refine((id) => isClarificationAnswerId(id) || isOutlierAnswerId(id), {
                message: 'id klarifikasi tidak dikenal',
              }),
            option: z.string().trim().min(1).max(80),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_ANSWERS_PER_CARD),
  })
  .strict();

@Controller('conversations')
export class MessageController {
  constructor(
    private readonly messages: MessageService,
    private readonly rateLimiter: RateLimiter,
    /** Contoh rumah (P22-01) — data; kosong bila berkasnya tidak ada. */
    @Optional()
    @Inject(HOUSE_EXAMPLES)
    private readonly houseExamples: readonly HouseExample[] = [],
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

  /**
   * `POST /conversations/:id/house-examples/:exampleId` — mulai dari contoh rumah (P22-01), nol
   * LLM. Contoh yang tidak dikenal → VALIDATION_FAILED; daftarnya dilayani `GET /house-examples`.
   */
  @Post(':id/house-examples/:exampleId')
  async houseExample(@Param() params: unknown, @Req() req: PublicRequest) {
    const { id, exampleId } = parse(ExampleParam, params);
    const example = this.houseExamples.find((e) => e.id === exampleId);
    if (!example) throw new RequestValidationError(['exampleId']);
    return this.messages.applyHouseExample(id, actorOf(req), example, new Date().toISOString());
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
    const { text, mode } = parse(MessageDto, body);
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
        // Tamu ditawari akun: batas pesan akun terdaftar ikut dikirim dari tabel kebijakan.
        const registered =
          actor.tier === 'guest' ? limitFor('registered', 'messages_per_hour') : null;
        throw new RateLimitedError(
          verdict.retryAfterSec,
          registered ? { tier: actor.tier, registeredMax: registered.max } : { tier: actor.tier },
        );
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
      events = await this.messages.handle(id, actor, text, now, writer.emit, mode ?? 'hemat');
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
