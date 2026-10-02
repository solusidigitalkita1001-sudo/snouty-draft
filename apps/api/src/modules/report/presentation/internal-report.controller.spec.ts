/**
 * P8-06a — rute cetak laporan tidak boleh terbuka tanpa peran internal.
 *
 * Tes ini lahir dari kesalahan nyata. Rute cetak semula hidup di controller yang sama
 * dengan rute publik laporan; karena `InternalRoleGuard` dipasang **per controller**,
 * rute itu berjalan tanpa gerbang dan mengembalikan HTTP 200 berisi nama pelanggan dan
 * lokasi proyek kepada siapa pun yang menebak id laporan. Ketangkap saat verifikasi
 * live, bukan oleh tes — jadi inilah tes yang memastikan ia tidak kembali.
 *
 * Seperti `internal-role.guard.spec.ts`, yang diuji adalah **kelas yang benar-benar
 * didekorasi** lewat `Reflector` sungguhan: yang paling mungkin salah bukan logika
 * perbandingan peran, melainkan apakah dekoratornya memang terpasang di tempatnya.
 */
import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import { REQUIRED_ROLE } from '../../../shared/http/internal-role.guard.js';
import { INTERNAL_ROLES } from '../../../shared/auth/roles.js';
import { InternalReportController } from './internal-report.controller.js';
import { ReportController } from './report.controller.js';

const reflector = new Reflector();

describe('InternalReportController', () => {
  it('memasang guard peran internal di tingkat controller', () => {
    // Nest menyimpan guard controller di metadata `__guards__`.
    const guards = Reflect.getMetadata('__guards__', InternalReportController) as
      unknown[] | undefined;
    expect(guards, 'controller cetak tanpa UseGuards').toBeDefined();
    expect(guards!.length).toBeGreaterThan(0);
  });

  it('menandai rute cetak dengan peran yang diminta', () => {
    const required = reflector.get<string | undefined>(
      REQUIRED_ROLE,
      InternalReportController.prototype.print,
    );
    expect(required).toBe(INTERNAL_ROLES.admin);
  });
});

describe('ReportController (publik)', () => {
  it('TIDAK memuat rute cetak — ia milik controller internal', () => {
    // Inti regresinya: begitu rute cetak kembali ke controller publik, ia kehilangan
    // gerbangnya tanpa ada yang gagal di tempat lain.
    expect('print' in ReportController.prototype).toBe(false);
  });

  it('tidak memasang guard peran internal (rute publik harus tetap terbuka)', () => {
    const guards = Reflect.getMetadata('__guards__', ReportController) as unknown[] | undefined;
    expect(guards ?? []).toHaveLength(0);
  });

  it('rute publiknya masih ada', () => {
    expect(typeof ReportController.prototype.create).toBe('function');
    expect(typeof ReportController.prototype.byId).toBe('function');
  });
});
