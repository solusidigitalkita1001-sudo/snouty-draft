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

  /**
   * `POST /reports` digerbang `REPORT_PDF` (hanya `advanced` di ENTITLEMENTS). Sebelum
   * pemeriksaan ini ada, tamu bisa membuat laporan lewat API — dibuktikan live 2026-10-05
   * — meski UI tidak menawarkannya. Lapis kedua ini yang membuat UI yang dilewati tidak
   * berarti apa-apa.
   */
  describe('POST /reports digerbang REPORT_PDF', () => {
    const body = {
      recommendationId: 'A'.repeat(26),
      customerName: 'Tamu Uji',
      projectLocation: 'Bandung',
    };
    const service = {
      created: 0,
      async create() {
        this.created += 1;
        return { id: 'R', reportNumber: 'SNTY-2026-10-0001', status: 'PENDING', createdAt: 'x' };
      },
    };
    const controller = () => new ReportController(service as never);

    it('tamu ditolak NOT_ENTITLED sebelum layanan tersentuh', async () => {
      service.created = 0;
      await expect(
        controller().create(body, { guestSessionId: 'G'.repeat(26) } as never),
      ).rejects.toMatchObject({ code: 'NOT_ENTITLED' });
      expect(service.created).toBe(0);
    });

    it('pengguna terdaftar biasa juga ditolak — REPORT_PDF hanya tier lanjutan', async () => {
      await expect(
        controller().create(body, {
          authUser: { id: 'U'.repeat(26), tier: 'registered', roles: [] },
        } as never),
      ).rejects.toMatchObject({ code: 'NOT_ENTITLED' });
    });

    it('tier lanjutan lolos ke layanan', async () => {
      service.created = 0;
      const response = await controller().create(body, {
        authUser: { id: 'U'.repeat(26), tier: 'advanced', roles: [] },
      } as never);
      expect(service.created).toBe(1);
      expect(response).toMatchObject({ reportNumber: 'SNTY-2026-10-0001', status: 'PENDING' });
    });
  });
});
