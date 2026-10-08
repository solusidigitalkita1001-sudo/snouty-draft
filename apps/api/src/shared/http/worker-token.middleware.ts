/**
 * Token layanan worker untuk rute `/internal/reports/*` (OQ-49, default disetujui 2026-10-06).
 *
 * `apps/worker` memanggil halaman cetak dan menandai READY/FAILED dengan
 * `Authorization: Bearer $WORKER_INTERNAL_TOKEN`. Token itu bukan JWT, jadi
 * `AccessTokenMiddleware` melewatkannya sebagai anonim dan `InternalRoleGuard` menjawab 401.
 * Middleware ini mengisi aktor layanan bila tokennya cocok — dan **hanya dipasang pada
 * `InternalReportController`**, supaya token worker tidak pernah membuka rute internal lain
 * (ia memegang `admin` hanya karena rute itu memintanya; cakupannya yang membatasi).
 *
 * Seperti `AccessTokenMiddleware`: mengisi, tidak pernah menolak. Token yang salah berakhir
 * 401 di guard, dengan jalur yang sama seperti permintaan tanpa token — tidak ada pesan yang
 * membedakan "token salah" dari "tidak ada token".
 *
 * Alternatif yang ditolak di OQ-49: JWT admin berumur panjang di env worker — kedaluwarsa
 * diam-diam dan tidak bisa dicabut tanpa memutar rahasia JWT seluruh pengguna.
 */
import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Optional, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { INTERNAL_ROLES } from '../auth/roles.js';
import type { InternalActor, WithInternalActor } from './internal-role.guard.js';

export const WORKER_INTERNAL_TOKEN = Symbol('WORKER_INTERNAL_TOKEN');

/** Aktor yang tercatat di audit untuk setiap tindakan worker. */
export const WORKER_ACTOR: InternalActor = Object.freeze({
  id: 'worker',
  roles: Object.freeze([INTERNAL_ROLES.admin]),
});

@Injectable()
export class WorkerTokenMiddleware implements NestMiddleware {
  constructor(@Optional() @Inject(WORKER_INTERNAL_TOKEN) private readonly token?: string) {}

  use(request: Request & WithInternalActor, _response: Response, next: NextFunction): void {
    const header = request.headers.authorization;
    if (
      this.token !== undefined &&
      typeof header === 'string' &&
      header.startsWith('Bearer ') &&
      constantTimeEqual(header.slice('Bearer '.length), this.token)
    ) {
      request.internalActor = WORKER_ACTOR;
    }
    next();
  }
}

/**
 * Perbandingan waktu-tetap. Panjang yang berbeda langsung `false`: `timingSafeEqual`
 * menolak buffer yang panjangnya beda, dan membocorkan panjang token bukan masalah —
 * panjangnya sudah tertulis di skema env.
 */
function constantTimeEqual(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
