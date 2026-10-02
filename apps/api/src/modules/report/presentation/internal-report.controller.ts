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
 * Desain finalnya **token bertanda tangan berumur pendek** (§5), bukan peran: memberi
 * worker token `admin` adalah hak akses jauh lebih besar dari yang ia butuhkan. Token
 * itu datang bersama worker-nya (terhalang OQ-40); sampai itu ada, gerbang peran
 * fail-closed menjaga rutenya tertutup.
 */
import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { INTERNAL_ROLES } from '../../../shared/auth/roles.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { InternalRoleGuard, RequiresRole } from '../../../shared/http/internal-role.guard.js';
import { renderReportHtml } from '../application/report-html.js';
import { ReportService } from '../application/report.service.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();

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
}
