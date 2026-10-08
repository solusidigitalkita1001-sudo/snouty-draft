/**
 * `/conversations/*` — bagian Fase 3 (docs/API_CONTRACTS.md §2). `POST
 * /conversations/:id/messages` (SSE) milik Fase 4 dan belum ada di sini.
 *
 * Yang ditegakkan lapis API (lapis dua dari tiga):
 *
 *   - **Daftar riwayat butuh `CONVERSATION_HISTORY`** — tamu tidak memilikinya
 *     (SPEC §4.2: tamu tidak melihat riwayat persisten). Percakapan AKTIF tamu
 *     tetap terjangkau lewat id-nya: yang digerbang adalah riwayat, bukan chat.
 *
 * Kepemilikan per percakapan diperiksa di service (lapis application).
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { LOCALES, localeFromAcceptLanguage } from '@snouty/shared-types';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { requireEntitled } from '../../../shared/http/entitlement.js';
import { ConversationService } from '../application/conversation.service.js';
import type { ConversationOwner, ConversationRow } from '../domain/conversation.repository.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const RenameDto = z.object({ title: z.string().trim().min(1).max(160) }).strict();
const CreateDto = z.object({ language: z.enum(LOCALES).optional() }).strict();
const ListQuery = z
  .object({
    status: z
      .enum([
        'IN_PROGRESS',
        'CHECKING_DATA',
        'ANALYZING',
        'INCOMPLETE_DATA',
        'SOLUTION_READY',
        'NEEDS_VALIDATION',
        'SAVED',
        'REOPENED',
      ])
      .optional(),
    q: z.string().trim().min(1).max(80).optional(),
    cursor: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversations: ConversationService) {}

  /**
   * Bahasa percakapan (Fase 15): dari body `{ language }` bila klien menyebutnya, selain itu
   * dari `Accept-Language`; nilai di luar `id`/`en` ditolak, bukan dibulatkan.
   */
  @Post()
  async create(@Req() request: PublicRequest, @Body() body: unknown) {
    const owner = ownerOf(request);
    const dto = parse(CreateDto, body ?? {});
    const language = dto.language ?? localeFromAcceptLanguage(request.headers['accept-language']);
    return summaryOf(await this.conversations.create(owner, language));
  }

  @Get()
  async list(@Req() request: PublicRequest) {
    const actor = actorOf(request);
    // Inilah gerbang yang diuji P3-11a: tamu yang melewati UI tetap berhenti di sini.
    requireEntitled(actor.tier, 'CONVERSATION_HISTORY');

    const query = parse(ListQuery, request.query);
    // Disusun per field — zod memberi `T | undefined` untuk opsional, sementara
    // `exactOptionalPropertyTypes` membedakan "tidak ada" dari "ada tapi undefined".
    const rows = await this.conversations.list(
      { kind: actor.kind, id: actor.id },
      {
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.q !== undefined ? { q: query.q } : {}),
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
        ...(query.limit !== undefined ? { limit: query.limit } : {}),
      },
    );
    return { items: rows.map(summaryOf) };
  }

  @Get(':id')
  async find(@Param() rawParam: unknown, @Req() request: PublicRequest) {
    const id = idOf(rawParam);
    const owner = ownerOf(request);
    const row = await this.conversations.find(id, owner);
    const messages = await this.conversations.messages(id, owner);
    return {
      ...summaryOf(row),
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        cards: message.cards,
        mood: message.mood,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  @Patch(':id')
  @HttpCode(204)
  async rename(
    @Param() rawParam: unknown,
    @Body() rawBody: unknown,
    @Req() request: PublicRequest,
  ): Promise<void> {
    const body = parse(RenameDto, rawBody);
    await this.conversations.rename(idOf(rawParam), ownerOf(request), body.title);
  }

  /**
   * "Simpan hasil konsultasi" (layar 06). Digerbang `SAVE_SOLUTION` — ini lapis dua
   * dari tiga: UI menyembunyikan tombolnya bagi tamu, gerbang ini menolak tamu yang
   * melewati UI, dan kepemilikan diperiksa di service.
   */
  @Post(':id/save')
  @HttpCode(204)
  async save(@Param() rawParam: unknown, @Req() request: PublicRequest): Promise<void> {
    const actor = actorOf(request);
    requireEntitled(actor.tier, 'SAVE_SOLUTION');
    await this.conversations.save(idOf(rawParam), { kind: actor.kind, id: actor.id });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param() rawParam: unknown, @Req() request: PublicRequest): Promise<void> {
    await this.conversations.remove(idOf(rawParam), ownerOf(request));
  }

  @Post(':id/restore')
  @HttpCode(204)
  async restore(@Param() rawParam: unknown, @Req() request: PublicRequest): Promise<void> {
    await this.conversations.restore(idOf(rawParam), ownerOf(request));
  }
}

function ownerOf(request: PublicRequest): ConversationOwner {
  const actor = actorOf(request);
  return { kind: actor.kind, id: actor.id };
}

function summaryOf(row: ConversationRow) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    stage: row.stage,
    language: row.language,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function idOf(rawParam: unknown): string {
  const result = IdParam.safeParse(rawParam);
  if (!result.success) throw new RequestValidationError(['id']);
  return result.data.id;
}

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new RequestValidationError([
      ...new Set(result.error.issues.map((issue) => issue.path.join('.') || 'query')),
    ]);
  }
  return result.data;
}
