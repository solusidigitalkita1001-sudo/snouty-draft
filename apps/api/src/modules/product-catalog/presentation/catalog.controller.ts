/**
 * API baca katalog (docs/API_CONTRACTS.md §2 — Katalog). Layar 10.
 *
 * Controller hanya mengurai dan mendelegasikan; tidak ada aturan bisnis di sini
 * (docs/CODING_STANDARDS.md §4). Yang memang miliknya hanya satu: mengubah apa
 * pun yang datang dari query string menjadi nilai domain, atau menolaknya.
 *
 * Tanpa guard, dan itu disengaja: `PRODUCT_QA` terbuka untuk `guest` pada tabel
 * `ENTITLEMENTS` (docs/POLICY.md §6). Guard berbasis peran menyusul bersama modul
 * `policy` di Fase 5 — dan ketika itu datang, ia dipasang dari tabel entitlement,
 * bukan dituliskan ulang di sini.
 */
import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { PipeSize } from '@snouty/shared-types';
import { CatalogQueryService } from '../application/catalog-query.service.js';
import { InvalidCatalogQueryError } from '../domain/catalog.errors.js';

/**
 * `.strict()`, bukan sekadar bentuk yang longgar: parameter tak dikenal
 * **ditolak**, tidak diabaikan. Mengabaikan field asing terasa ramah sampai ada
 * satu field asing yang kebetulan berfungsi (docs/SECURITY.md §4).
 */
const ListProductsQuery = z
  .object({
    family: z.string().min(1).max(80).optional(),
    category: z.string().min(1).max(120).optional(),
    /** Ditulis bebas (`3/4`, `1.25`, `1¼"`) lalu dikanonikkan oleh `PipeSize`. */
    size: z.string().min(1).max(16).optional(),
    q: z.string().min(1).max(80).optional(),
    status: z.enum(['active', 'discontinued']).optional(),
    cursor: z.string().min(1).max(64).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

const ProductIdParam = z.object({ id: z.string().length(26) }).strict();

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogQueryService) {}

  @Get('catalog/version')
  async activeVersion() {
    return this.catalog.activeVersion();
  }

  @Get('products')
  async listProducts(@Query() rawQuery: unknown) {
    const parsed = ListProductsQuery.safeParse(rawQuery);
    if (!parsed.success) throw new InvalidCatalogQueryError(fieldsOf(parsed.error));

    // Setiap field disusun satu per satu, dan itu bukan bertele-tele: zod
    // menghasilkan `T | undefined` untuk field opsional, sementara
    // `exactOptionalPropertyTypes` membedakan "tidak ada" dari "ada tapi
    // undefined". Menyebar objeknya apa adanya akan menyelundupkan `undefined`
    // ke dalam klausa WHERE repository.
    const { size, family, category, q, status, cursor, limit } = parsed.data;
    return this.catalog.listProducts({
      ...(family !== undefined ? { family } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(q !== undefined ? { q } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(size !== undefined ? { size: parseSize(size) } : {}),
    });
  }

  @Get('products/:id')
  async findProduct(@Param() rawParam: unknown) {
    return this.catalog.findProduct(productId(rawParam));
  }

  @Get('products/:id/compatible')
  async findCompatibleFittings(@Param() rawParam: unknown) {
    const items = await this.catalog.findCompatibleFittings(productId(rawParam));
    return { items };
  }

  /**
   * Dokumen teknis untuk "Buka dokumen teknis" di drawer. Ditawarkan kepada pengguna,
   * bukan dibaca untuk mengisi spesifikasi yang kosong (docs/PRODUCT_KNOWLEDGE.md §4).
   */
  @Get('products/:id/documents')
  async findProductDocuments(@Param() rawParam: unknown) {
    const items = await this.catalog.findProductDocuments(productId(rawParam));
    return { items };
  }
}

function productId(rawParam: unknown): string {
  const parsed = ProductIdParam.safeParse(rawParam);
  if (!parsed.success) throw new InvalidCatalogQueryError(['id']);
  return parsed.data.id;
}

/**
 * Ukuran yang tidak terbaca ditolak, tidak dibulatkan ke ukuran terdekat.
 * Memaksakan nilai di sini akan menjadi tebakan diam-diam (SPEC §5 Policy 2).
 */
function parseSize(raw: string): PipeSize {
  const size = PipeSize.parse(raw);
  if (size === null) throw new InvalidCatalogQueryError(['size']);
  return size;
}

/** Nama field yang bermasalah saja — pesan zod ditulis untuk pengembang, bukan pengguna. */
function fieldsOf(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join('.') || 'query'))];
}
