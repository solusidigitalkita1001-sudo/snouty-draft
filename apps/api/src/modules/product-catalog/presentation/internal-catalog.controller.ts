/**
 * Back-office katalog — `/internal/catalog/*`, peran `catalog_admin`
 * (docs/BACKOFFICE.md §4.1).
 *
 * **Yang belum ada di sini, dan mengapa:** unggah berkas katalog. Ia menunggu
 * OQ-07, karena adapter formatnya belum bisa ditulis sebelum format katalog Pralon
 * yang sebenarnya diketahui. Yang sudah bisa dibangun tanpa jawaban itu adalah
 * seluruh sisanya: melihat versi, membaca laporan validasi, dan mempromosikan
 * draft menjadi aktif.
 *
 * Layarnya sendiri menunggu OQ-21 (back-office belum punya desain). Kontraknya
 * dibangun lebih dulu dengan sengaja — ketika desainnya datang, yang dikerjakan
 * tinggal tampilannya.
 */
import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { INTERNAL_ROLES } from '../../../shared/auth/roles.js';
import type { WithCorrelationId } from '../../../shared/http/correlation-id.middleware.js';
import {
  auditActorOf,
  InternalRoleGuard,
  RequiresRole,
  type WithInternalActor,
} from '../../../shared/http/internal-role.guard.js';
import { CatalogAdminService } from '../application/catalog-admin.service.js';
import { CatalogPromotionService } from '../application/catalog-promotion.service.js';
import { InvalidCatalogQueryError } from '../domain/catalog.errors.js';

const UlidParam = z.object({ id: z.string().length(26) }).strict();

type InternalRequest = Request & WithCorrelationId & WithInternalActor;

@Controller('internal/catalog')
@UseGuards(InternalRoleGuard)
@RequiresRole(INTERNAL_ROLES.catalogAdmin)
export class InternalCatalogController {
  constructor(
    private readonly admin: CatalogAdminService,
    private readonly promotion: CatalogPromotionService,
  ) {}

  /** Termasuk draft dan yang diarsipkan — justru itu gunanya layar ini. */
  @Get('versions')
  async listVersions() {
    const items = await this.admin.listVersions();
    return { items };
  }

  @Get('imports/:id')
  async findImportRun(@Param() rawParam: unknown) {
    return this.admin.findImportRun(ulidOf(rawParam));
  }

  /**
   * Promosi draft → aktif.
   *
   * Aksi berdampak paling luas di seluruh back-office: ia mengubah apa yang dilihat
   * semua pengguna. Konfirmasinya ada di UI (docs/BACKOFFICE.md §4.1); yang dijamin
   * di sisi server adalah audit dan invalidasi cache, keduanya di dalam
   * `CatalogPromotionService`.
   *
   * `200`, bukan `202`: pekerjaannya sudah selesai saat respons dikirim. Tidak ada
   * job, tidak ada antrean, tidak ada yang perlu ditanyakan ulang.
   */
  @Post('versions/:id/promote')
  @HttpCode(200)
  async promote(@Param() rawParam: unknown, @Req() request: InternalRequest) {
    return this.promotion.promote({
      catalogVersionId: ulidOf(rawParam),
      actor: auditActorOf(request, INTERNAL_ROLES.catalogAdmin),
    });
  }
}

function ulidOf(rawParam: unknown): string {
  const parsed = UlidParam.safeParse(rawParam);
  if (!parsed.success) throw new InvalidCatalogQueryError(['id']);
  return parsed.data.id;
}
