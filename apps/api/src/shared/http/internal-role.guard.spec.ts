/**
 * P1-10a — **rute `/internal/*` menolak peran selain yang diminta.**
 *
 * Dipakai `Reflector` sungguhan dan kelas yang benar-benar didekorasi, bukan
 * metadata palsu: yang paling mungkin salah di guard semacam ini bukan logika
 * perbandingannya, melainkan apakah metadata perannya benar-benar terbaca.
 */
import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { INTERNAL_ROLES } from '../auth/roles.js';
import {
  InternalRouteMisconfiguredError,
  NotEntitledError,
  UnauthenticatedError,
} from './api-errors.js';
import {
  auditActorOf,
  InternalRoleGuard,
  RequiresRole,
  type InternalActor,
  type WithInternalActor,
} from './internal-role.guard.js';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware.js';

/** Peran dipasang di tingkat kelas, persis seperti controller sungguhan. */
@RequiresRole(INTERNAL_ROLES.catalogAdmin)
class CatalogRoutes {
  promote(): void {}
}

/** Peran dipasang di tingkat method — juga harus terbaca. */
class MixedRoutes {
  @RequiresRole(INTERNAL_ROLES.domainExpert)
  validateRule(): void {}

  /** Lupa diberi peran. Ini yang harus gagal tertutup. */
  forgotten(): void {}
}

function contextFor(
  target: new () => object,
  handler: (...args: never[]) => unknown,
  request: object,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => target,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guard(): InternalRoleGuard {
  return new InternalRoleGuard(new Reflector());
}

const CATALOG_ADMIN: InternalActor = { id: 'ADMIN', roles: [INTERNAL_ROLES.catalogAdmin] };

describe('InternalRoleGuard — gagal tertutup', () => {
  it('menolak permintaan tanpa aktor terautentikasi', () => {
    // Inilah keadaan setiap rute internal sampai modul `auth` ada di Fase 3, dan
    // itu keadaan yang benar: rute back-office yang terbuka tanpa autentikasi jauh
    // lebih berbahaya daripada rute back-office yang belum bisa dipakai.
    const context = contextFor(CatalogRoutes, CatalogRoutes.prototype.promote, {});

    expect(() => guard().canActivate(context)).toThrow(UnauthenticatedError);
  });

  it('menolak rute internal yang lupa menyebut peran yang dibutuhkan', () => {
    // Rute internal tanpa peran adalah rute internal tanpa pagar. Gagal tertutup
    // membuat kelalaian itu terlihat pada permintaan pertama, bukan pada insiden.
    const context = contextFor(MixedRoutes, MixedRoutes.prototype.forgotten, {
      internalActor: CATALOG_ADMIN,
    });

    expect(() => guard().canActivate(context)).toThrow(InternalRouteMisconfiguredError);
  });
});

describe('InternalRoleGuard — peran', () => {
  it('mengizinkan aktor yang memegang peran yang diminta', () => {
    const context = contextFor(CatalogRoutes, CatalogRoutes.prototype.promote, {
      internalActor: CATALOG_ADMIN,
    });

    expect(guard().canActivate(context)).toBe(true);
  });

  it('menolak peran internal lain', () => {
    const context = contextFor(CatalogRoutes, CatalogRoutes.prototype.promote, {
      internalActor: { id: 'X', roles: [INTERNAL_ROLES.salesReviewer] },
    });

    expect(() => guard().canActivate(context)).toThrow(NotEntitledError);
  });

  it('tidak mewariskan peran: `admin` bukan `catalog_admin`', () => {
    // docs/BACKOFFICE.md §7 tes 8. `admin` mengelola akun dan melihat audit log;
    // itu bukan izin mengubah apa yang dilihat semua pengguna.
    const context = contextFor(CatalogRoutes, CatalogRoutes.prototype.promote, {
      internalActor: { id: 'X', roles: [INTERNAL_ROLES.admin] },
    });

    expect(() => guard().canActivate(context)).toThrow(NotEntitledError);
  });

  it('menerima aktor yang memegang beberapa peran sekaligus', () => {
    const context = contextFor(CatalogRoutes, CatalogRoutes.prototype.promote, {
      internalActor: { id: 'X', roles: [INTERNAL_ROLES.admin, INTERNAL_ROLES.catalogAdmin] },
    });

    expect(guard().canActivate(context)).toBe(true);
  });

  it('membaca peran yang dipasang di tingkat method, bukan hanya kelas', () => {
    const context = contextFor(MixedRoutes, MixedRoutes.prototype.validateRule, {
      internalActor: { id: 'X', roles: [INTERNAL_ROLES.domainExpert] },
    });

    expect(guard().canActivate(context)).toBe(true);
  });

  it('menyebut peran yang kurang di details, supaya layar bisa menjelaskannya', () => {
    const context = contextFor(CatalogRoutes, CatalogRoutes.prototype.promote, {
      internalActor: { id: 'X', roles: [] },
    });

    try {
      guard().canActivate(context);
      throw new Error('seharusnya ditolak');
    } catch (error) {
      expect(error).toBeInstanceOf(NotEntitledError);
      expect((error as NotEntitledError).details).toEqual({ role: 'catalog_admin' });
    }
  });
});

describe('auditActorOf', () => {
  it('mencatat peran yang dipakai rute, bukan seluruh peran aktor', () => {
    // Audit menjawab "dilakukan sebagai apa", bukan "boleh apa saja". Aktor yang
    // memegang tiga peran tetap mempromosikan katalog sebagai `catalog_admin`.
    const request = {
      internalActor: { id: 'ADMIN', roles: [INTERNAL_ROLES.admin, INTERNAL_ROLES.catalogAdmin] },
      correlationId: 'corr-1',
      ip: '10.0.0.7',
      headers: { [CORRELATION_ID_HEADER]: 'corr-1' },
    };

    const actor = auditActorOf(request as never, INTERNAL_ROLES.catalogAdmin);

    expect(actor).toEqual({
      id: 'ADMIN',
      role: 'catalog_admin',
      correlationId: 'corr-1',
      ip: '10.0.0.7',
    });
  });

  it('menghilangkan ip saat tidak diketahui alih-alih menuliskannya kosong', () => {
    const request: WithInternalActor & { correlationId: string } = {
      internalActor: CATALOG_ADMIN,
      correlationId: 'corr-2',
    };

    const actor = auditActorOf(request as never, INTERNAL_ROLES.catalogAdmin);

    expect(actor).not.toHaveProperty('ip');
  });

  it('menolak menyusun aktor audit tanpa aktor terautentikasi', () => {
    expect(() => auditActorOf({ headers: {} } as never, INTERNAL_ROLES.catalogAdmin)).toThrow(
      UnauthenticatedError,
    );
  });
});
