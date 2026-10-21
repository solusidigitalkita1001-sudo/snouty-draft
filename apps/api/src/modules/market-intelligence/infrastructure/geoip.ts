/**
 * Geolokasi IP lewat DB-IP Lite (mmdb, CC BY 4.0 — atribusi di dashboard pasar dan PRIVACY.md).
 * Dibaca dari berkas lokal, tidak ada permintaan ke pihak luar per kunjungan. IP tidak disimpan;
 * yang keluar hanya provinsi. Tanpa berkas: setiap pencarian `null`, sekali dicatat di log.
 */
import { existsSync } from 'node:fs';
import maxmind, { type CityResponse, type Reader } from 'maxmind';
import type { Logger } from 'pino';
import { provinceOf } from '../domain/region.js';

export class GeoIpLookup {
  private reader: Promise<Reader<CityResponse> | null> | null = null;

  constructor(
    private readonly path: string | undefined,
    private readonly log: Pick<Logger, 'warn'> | null = null,
  ) {}

  async provinceOf(ip: string | undefined): Promise<string | null> {
    if (ip === undefined || ip === '') return null;
    const reader = await this.open();
    if (reader === null) return null;
    try {
      return provinceOf(reader.get(ip.replace(/^::ffff:/, '')));
    } catch {
      return null;
    }
  }

  private open(): Promise<Reader<CityResponse> | null> {
    this.reader ??= (async () => {
      if (this.path === undefined || !existsSync(this.path)) {
        this.log?.warn(
          { path: this.path },
          'basis data geolokasi IP tidak ada; event pasar tanpa wilayah',
        );
        return null;
      }
      try {
        return await maxmind.open<CityResponse>(this.path);
      } catch (error) {
        this.log?.warn({ err: error, path: this.path }, 'basis data geolokasi IP tidak terbaca');
        return null;
      }
    })();
    return this.reader;
  }
}
