/**
 * Mengisi aktor dari header `Authorization: Bearer …`. P3-07.
 *
 * Middleware ini **mengisi, tidak pernah menolak**. Permintaan tanpa token, atau
 * dengan token yang tidak sah, lewat sebagai anonim — dan guard di rutenyalah yang
 * memutuskan apakah anonim boleh masuk. Pemisahan itu disengaja: rute publik
 * (katalog, chat tamu) memang dilayani tanpa token, dan `InternalRoleGuard` sudah
 * gagal-tertutup sejak P1-10 — token tidak sah di rute internal berakhir `401`
 * karena aktornya kosong, bukan karena middleware ini melempar.
 *
 * Inilah kepingan yang membuat `/internal/*` berhenti menjawab 401 untuk semua
 * orang: sejak P1-10, guard-nya menunggu seseorang mengisi `internalActor`.
 */
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  ACCESS_TOKEN_SERVICE,
  type AccessTokenClaims,
  type AccessTokenService,
} from '../infrastructure/jwt-access-token.service.js';
import type { WithInternalActor } from '../../../shared/http/internal-role.guard.js';

export interface WithAuthUser {
  /** Klaim access token yang terverifikasi. Kosong berarti anonim. */
  authUser?: AccessTokenClaims;
  /**
   * Token Bearer dikirim tetapi tidak sah. Middleware ini tetap tidak menolak (worker memakai
   * Bearer non-JWT di `/internal/reports`); `RejectStaleTokenMiddleware` yang menolaknya di
   * rute publik.
   */
  authTokenRejected?: boolean;
}

@Injectable()
export class AccessTokenMiddleware implements NestMiddleware {
  constructor(@Inject(ACCESS_TOKEN_SERVICE) private readonly tokens: AccessTokenService) {}

  async use(
    request: Request & WithAuthUser & WithInternalActor,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    const header = request.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      const claims = await this.tokens.verify(header.slice('Bearer '.length));
      if (claims !== null) {
        request.authUser = claims;
        // `internalActor` yang ditunggu InternalRoleGuard. Perannya datang dari
        // klaim token — artinya pencabutan peran berlaku paling lambat satu umur
        // access token, jendela yang memang dibeli oleh TTL pendeknya.
        request.internalActor = { id: claims.userId, roles: claims.roles };
      } else {
        request.authTokenRejected = true;
      }
    }
    next();
  }
}
