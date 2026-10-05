#!/usr/bin/env node
/**
 * Mencetak token akses untuk `apps/worker` — alat pengembangan lokal, dipakai
 * scripts/dev-up.ps1.
 *
 * Worker memanggil `/internal/reports/*`, yang bergerbang peran `admin`. Desain finalnya
 * token bertanda tangan berumur pendek khusus worker (docs/REPORT.md §5); sampai itu ada,
 * pengembangan memakai token akses biasa berperan `admin`, ditandatangani dengan rahasia
 * JWT pengembangan yang sama dengan API. Bentuknya mengikuti JwtAccessTokenService.
 *
 * Berumur 7 hari supaya worker tidak mati diam-diam di tengah sesi uji, dan karena itu
 * hanya mau berjalan dengan NODE_ENV=development.
 */
import { SignJWT } from 'jose';

if (process.env.NODE_ENV !== 'development') {
  console.error('✖ Hanya untuk NODE_ENV=development.');
  process.exit(1);
}
const secret = process.env.JWT_ACCESS_SECRET;
if (!secret) {
  console.error('✖ JWT_ACCESS_SECRET wajib diset — harus sama dengan milik API.');
  process.exit(1);
}

const token = await new SignJWT({ tier: 'registered', roles: ['admin'] })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('dev-worker')
  .setIssuer('snouty-api')
  .setIssuedAt()
  .setExpirationTime('7d')
  .sign(new TextEncoder().encode(secret));

process.stdout.write(token);
