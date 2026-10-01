/**
 * Penjagaan peran untuk seluruh rute `/internal/*` (docs/API_CONTRACTS.md §2,
 * docs/SECURITY.md §3).
 *
 * Tiga lapis otorisasi disebut `docs/SECURITY.md`: UI menyembunyikan, API guard
 * menolak, perakitan respons menyaring. Ini lapis kedua — dan lapis yang paling
 * penting, karena dua lapis lainnya bisa dilewati dengan `curl`.
 *
 * **Guard ini gagal tertutup.** Selama modul `auth` belum ada (Fase 3), tidak ada
 * yang mengisi aktor pada request, jadi setiap rute internal menjawab `401`. Itu
 * keadaan yang benar untuk sekarang: rute back-office yang terbuka tanpa autentikasi
 * jauh lebih berbahaya daripada rute back-office yang belum bisa dipakai. Ketika
 * Fase 3 datang, yang berubah hanya siapa yang mengisi `internalActor` — bukan
 * guard ini.
 */
import { Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuditActor } from '../audit/audit.types.js';
import {
  InternalRouteMisconfiguredError,
  NotEntitledError,
  UnauthenticatedError,
} from './api-errors.js';
import { correlationIdOf, type WithCorrelationId } from './correlation-id.middleware.js';

const REQUIRED_ROLE = 'snouty:requiredRole';

/**
 * Peran yang wajib dipegang untuk menyentuh rute ini.
 *
 * Wajib ada pada setiap rute internal; `InternalRoleGuard` menolak rute yang tidak
 * menyebutkannya, supaya peran yang lupa dipasang tidak berarti rute tanpa pagar.
 */
export const RequiresRole = (role: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ROLE, role);

/** Aktor internal yang sudah terautentikasi. Diisi modul `auth` di Fase 3. */
export interface InternalActor {
  readonly id: string;
  readonly roles: readonly string[];
}

export interface WithInternalActor {
  internalActor?: InternalActor;
}

/**
 * Menyusun aktor audit dari request.
 *
 * Correlation ID dan IP diambil dari request, bukan dari body: keduanya adalah
 * fakta tentang permintaannya, dan apa pun yang datang dari body bisa dikarang
 * pengirimnya.
 */
export function auditActorOf(
  request: Request & WithCorrelationId & WithInternalActor,
  role: string,
): AuditActor {
  const actor = request.internalActor;
  if (actor === undefined) throw new UnauthenticatedError();

  const ip = request.ip;
  return {
    id: actor.id,
    role,
    correlationId: correlationIdOf(request),
    ...(ip !== undefined ? { ip } : {}),
  };
}

@Injectable()
export class InternalRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string | undefined>(REQUIRED_ROLE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined) {
      throw new InternalRouteMisconfiguredError(context.getClass().name);
    }

    const request = context.switchToHttp().getRequest<Request & WithInternalActor>();
    const actor = request.internalActor;
    if (actor === undefined) throw new UnauthenticatedError();
    if (!actor.roles.includes(required)) throw new NotEntitledError(required);

    return true;
  }
}
