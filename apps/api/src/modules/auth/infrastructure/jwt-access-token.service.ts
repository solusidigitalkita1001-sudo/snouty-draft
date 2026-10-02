/**
 * Access token: JWT HS256 berumur pendek, diverifikasi tanpa database.
 *
 * HS256, bukan RS256, karena penanda tangan dan pemverifikasinya proses yang sama —
 * monolith ini tidak membagikan kunci verifikasi ke siapa pun. Pasangan kunci
 * asimetris baru berarti sesuatu ketika ada pihak kedua yang memverifikasi; sebelum
 * itu ia hanya kunci privat kedua yang bisa bocor.
 *
 * Klaim dibuat sesempit mungkin: `sub`, `tier`, `roles`. Tidak ada email atau nama —
 * JWT hanya base64, bukan terenkripsi, dan apa pun di dalamnya terbaca siapa saja
 * yang memegangnya. Yang tidak dibawa tidak bisa bocor.
 */
import { Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { loadEnv } from '../../../config/env.js';

export const ACCESS_TOKEN_SERVICE = Symbol('ACCESS_TOKEN_SERVICE');

export interface AccessTokenClaims {
  /** `sub` — id pengguna. */
  readonly userId: string;
  readonly tier: 'registered' | 'advanced';
  readonly roles: readonly string[];
}

export interface AccessTokenService {
  sign(claims: AccessTokenClaims): Promise<string>;
  /** `null` untuk token apa pun yang tidak sah — kedaluwarsa, dipalsukan, atau rusak. */
  verify(token: string): Promise<AccessTokenClaims | null>;
}

const ISSUER = 'snouty-api';

@Injectable()
export class JwtAccessTokenService implements AccessTokenService {
  private readonly secret: Uint8Array;
  private readonly ttlSeconds: number;

  constructor() {
    const env = loadEnv();
    this.secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    this.ttlSeconds = env.JWT_ACCESS_TTL;
  }

  async sign(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ tier: claims.tier, roles: [...claims.roles] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      // `algorithms` dikunci ke HS256: tanpa itu, token ber-header `alg: none`
      // atau algoritme lain ikut dipertimbangkan — kebingungan algoritme adalah
      // kegagalan JWT paling klasik yang ada.
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: ISSUER,
        algorithms: ['HS256'],
      });

      if (typeof payload.sub !== 'string') return null;
      if (payload.tier !== 'registered' && payload.tier !== 'advanced') return null;
      const roles = Array.isArray(payload.roles)
        ? payload.roles.filter((role): role is string => typeof role === 'string')
        : [];

      return { userId: payload.sub, tier: payload.tier, roles };
    } catch {
      // Token tidak sah adalah keadaan yang diperkirakan, bukan kegagalan sistem.
      return null;
    }
  }
}

export const accessTokenServiceProvider = {
  provide: ACCESS_TOKEN_SERVICE,
  useFactory: (): AccessTokenService => new JwtAccessTokenService(),
};
