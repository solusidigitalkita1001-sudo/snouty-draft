/**
 * `POST /uploads` (multipart: `file` + `conversationId`) dan `GET /uploads/:id/download`.
 * docs/API_CONTRACTS.md §3 · docs/SECURITY.md §7.
 *
 * Tidak digerbang entitlement: denah paling berguna bagi tamu yang kasusnya akan diteruskan ke
 * tim teknis. Yang membatasi adalah kuota harian per tier (`uploads_per_day`).
 */
import { createReadStream } from 'node:fs';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { loadEnv } from '../../../config/env.js';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { UploadRejectedError, UploadsService } from '../application/uploads.service.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const UploadDto = z.object({ conversationId: z.string().length(26) }).strict();

/** Bentuk berkas dari multer (memoryStorage) yang dipakai di sini. */
interface MultipartFile {
  readonly originalname: string;
  readonly buffer: Buffer;
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      // Sedikit di atas batas supaya berkas kebesaran ditolak oleh kebijakan dengan pesan yang
      // jelas, bukan putus di tengah oleh multer. Nginx memotong lebih dulu di 12 MB.
      limits: { fileSize: (loadEnv().UPLOAD_MAX_MB + 1) * 1024 * 1024, files: 1, fields: 4 },
    }),
  )
  async upload(
    @UploadedFile() file: MultipartFile | undefined,
    @Body() body: unknown,
    @Req() req: PublicRequest,
  ): Promise<unknown> {
    const { conversationId } = parse(UploadDto, body);
    if (!file) throw new UploadRejectedError('empty');
    const result = await this.uploads.upload(
      conversationId,
      actorOf(req),
      file.originalname,
      new Uint8Array(file.buffer),
    );
    return {
      id: result.upload.id,
      fileName: result.upload.originalName,
      mimeType: result.upload.mimeType,
      sizeBytes: result.upload.sizeBytes,
      userText: result.userText,
      replyText: result.replyText,
    };
  }

  @Get(':id/download')
  async download(
    @Param() params: unknown,
    @Req() req: PublicRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { id } = parse(IdParam, params);
    const { path, row } = await this.uploads.fileFor(id, actorOf(req));
    res.set({
      'content-type': row.mimeType,
      // Selalu `attachment` (SECURITY.md §7): berkas pengguna tidak pernah dirender di origin ini.
      'content-disposition': `attachment; filename="${asciiName(row.originalName)}"; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    });
    return new StreamableFile(createReadStream(path));
  }
}

/** Nama cadangan ASCII untuk header `filename=` — tanpa kutip dan karakter di luar ASCII. */
function asciiName(name: string): string {
  return name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
