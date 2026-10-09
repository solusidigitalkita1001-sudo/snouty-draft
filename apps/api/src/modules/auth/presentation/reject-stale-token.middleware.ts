/**
 * Rute publik: token Bearer yang dikirim tetapi tidak sah → 401, bukan diperlakukan sebagai tamu.
 *
 * Pengguna yang sudah masuk selalu mengirim token; bila tokennya kedaluwarsa dan permintaannya
 * dilayani sebagai tamu, percakapan miliknya "tidak ditemukan" (404) dan web tidak punya alasan
 * memperbarui sesi. Tamu sungguhan tidak pernah mengirim Bearer, jadi tidak terpengaruh.
 * Tidak dipasang di `/internal` (token worker bukan JWT) dan `/auth` (login, refresh).
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ExpiredAccessTokenError } from '../domain/auth.errors.js';
import type { WithAuthUser } from './access-token.middleware.js';

@Injectable()
export class RejectStaleTokenMiddleware implements NestMiddleware {
  use(request: Request & WithAuthUser, _response: Response, next: NextFunction): void {
    if (request.authTokenRejected) throw new ExpiredAccessTokenError();
    next();
  }
}
