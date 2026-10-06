/**
 * `GET /internal/reports/:id/print` — halaman cetak untuk Chromium di worker.
 * docs/REPORT.md §5, §7.
 *
 * Controller terpisah karena `InternalRoleGuard` dipasang **per controller**: rute ini
 * mengembalikan dokumen berisi nama pelanggan dan lokasi proyek **tanpa pemeriksaan
 * pemilik** (pemanggilnya sistem, bukan pengguna), jadi ia tidak boleh berbagi kelas
 * dengan rute publik. Tanpa pemisahan ini, id laporan yang ditebak cukup untuk membaca
 * data pribadi — pelanggaran invarian RP-2 dan kewajiban UU PDP, bukan sekadar
 * kerapian.
 *
 * Pemanggilnya worker dengan **token layanan** `WORKER_INTERNAL_TOKEN` (OQ-49):
 * `WorkerTokenMiddleware` — dipasang hanya pada controller ini — mengisi aktor `worker`
 * berperan `admin` bila tokennya cocok, lalu gerbang peran yang sama memutuskan. Peran
 * `admin` memang lebih besar dari yang worker butuhkan; cakupan middleware (controller ini
 * saja) yang membatasinya, bukan perannya. Tanpa token di env, rutenya tetap tertutup.
 */
import { Body, Controller, Get, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { INTERNAL_ROLES } from '../../../shared/auth/roles.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { InternalRoleGuard, RequiresRole } from '../../../shared/http/internal-role.guard.js';
import { renderReportHtml } from '../application/report-html.js';
import { ReportService } from '../application/report.service.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const ReadyDto = z.object({ fileRef: z.string().min(1).max(255) }).strict();
const FailedDto = z.object({ reason: z.string().min(1).max(255) }).strict();

@Controller('internal/reports')
@UseGuards(InternalRoleGuard)
export class InternalReportController {
  constructor(private readonly reports: ReportService) {}

  @Get(':id/print')
  @RequiresRole(INTERNAL_ROLES.admin)
  @Header('content-type', 'text/html; charset=utf-8')
  async print(@Param() params: unknown): Promise<string> {
    const result = IdParam.safeParse(params);
    if (!result.success) throw new RequestValidationError(['id']);
    const report = await this.reports.findForPrint(result.data.id);
    return renderReportHtml(report.payload);
  }

  /**
   * Worker melaporkan PDF-nya selesai. Dipanggil sistem, bukan pengguna — karena itu di
   * bawah `/internal` dan bergerbang peran.
   *
   * API yang menandai status, bukan worker yang menulis ke database langsung: worker tidak
   * memegang kredensial database sama sekali, dan itu yang menjaga arah dependensi OQ-40.
   */
  @Post(':id/ready')
  @RequiresRole(INTERNAL_ROLES.admin)
  @HttpCode(204)
  async markReady(@Param() params: unknown, @Body() body: unknown): Promise<void> {
    const id = parseId(params);
    const dto = ReadyDto.safeParse(body);
    if (!dto.success) throw new RequestValidationError(['fileRef']);
    await this.reports.markReady(id, dto.data.fileRef);
  }

  /** Worker melaporkan kegagalan final (timeout, Chromium mati). */
  @Post(':id/failed')
  @RequiresRole(INTERNAL_ROLES.admin)
  @HttpCode(204)
  async markFailed(@Param() params: unknown, @Body() body: unknown): Promise<void> {
    const id = parseId(params);
    const dto = FailedDto.safeParse(body);
    if (!dto.success) throw new RequestValidationError(['reason']);
    await this.reports.markFailed(id, dto.data.reason);
  }
}

function parseId(params: unknown): string {
  const result = IdParam.safeParse(params);
  if (!result.success) throw new RequestValidationError(['id']);
  return result.data.id;
}
