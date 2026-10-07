/**
 * `POST /reports` dan `GET /reports/:id` — rute PUBLIK laporan.
 * docs/API_CONTRACTS.md §2 · docs/REPORT.md §7, §8.
 *
 * Rute cetak internal sengaja hidup di controller TERPISAH
 * (`internal-report.controller.ts`): guard peran dipasang per controller, jadi
 * mencampur rute publik dan internal di satu kelas berarti memilih antara menggerbang
 * rute publik atau membiarkan rute internal terbuka. Pemisahan ini yang membuat
 * pilihannya tidak pernah perlu diambil.
 */
import { createReadStream } from 'node:fs';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { requireEntitled } from '../../../shared/http/entitlement.js';
import { ReportService } from '../application/report.service.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();

const CreateReportDto = z
  .object({
    recommendationId: z.string().length(26),
    customerName: z.string().trim().min(1).max(120),
    projectLocation: z.string().trim().min(1).max(160),
  })
  .strict();

@Controller()
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  /**
   * Digerbang `REPORT_PDF` — hanya tier yang berhak di tabel `ENTITLEMENTS`. Sebelum ini
   * rute dibiarkan terbuka dan tamu bisa membuat laporan lewat API meski UI tidak
   * menawarkannya; pemeriksaan di sini lapis kedua setelah UI (docs/POLICY.md §6).
   * 202, bukan 201: laporannya ada, PDF-nya menyusul lewat antrean.
   */
  @Post('reports')
  @HttpCode(202)
  async create(@Body() body: unknown, @Req() req: PublicRequest): Promise<unknown> {
    const actor = actorOf(req);
    requireEntitled(actor.tier, 'REPORT_PDF');
    const dto = parse(CreateReportDto, body);
    const now = new Date().toISOString();
    const report = await this.reports.create(
      dto.recommendationId,
      actor,
      {
        customerName: dto.customerName,
        projectLocation: dto.projectLocation,
        consultationDate: now.slice(0, 10),
      },
      now,
    );
    return {
      id: report.id,
      reportNumber: report.reportNumber,
      status: report.status,
      createdAt: report.createdAt,
    };
  }

  /** Pratinjau di layar — alur yang dipilih desain (docs/REPORT.md §8). */
  @Get('reports/:id')
  async byId(@Param() params: unknown, @Req() req: PublicRequest): Promise<unknown> {
    const id = parse(IdParam, params).id;
    const report = await this.reports.findForActor(id, actorOf(req));
    return {
      id: report.id,
      reportNumber: report.reportNumber,
      status: report.status,
      payload: report.payload,
      fileRef: report.fileRef,
      createdAt: report.createdAt,
    };
  }

  /**
   * Unduhan PDF oleh pemilik (docs/REPORT.md §7). Berbasis sesi, bukan URL berkas:
   * kepemilikan diperiksa layanan, jalurnya dipastikan di dalam akar penyimpanan, dan
   * nama berkasnya nomor laporan — bukan id internal.
   */
  @Get('reports/:id/download')
  async download(
    @Param() params: unknown,
    @Req() req: PublicRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const id = parse(IdParam, params).id;
    const file = await this.reports.pdfFor(id, actorOf(req));
    res.set({
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${file.fileName}"`,
      'cache-control': 'private, no-store',
    });
    return new StreamableFile(createReadStream(file.absolutePath));
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
