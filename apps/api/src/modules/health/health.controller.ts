import { Controller, Get, HttpCode } from '@nestjs/common';
import { HealthService, type HealthReport } from './health.service.js';

const VERSION = process.env['npm_package_version'] ?? '0.0.0';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Selalu 200: load balancer memakai /health/ready untuk keputusan trafik,
   * sedangkan /health adalah laporan diagnostik yang harus tetap terbaca
   * justru ketika ada yang bermasalah.
   */
  @Get()
  @HttpCode(200)
  async check(): Promise<HealthReport> {
    return this.health.check(VERSION);
  }

  @Get('ready')
  async ready(): Promise<{ ready: boolean }> {
    const report = await this.health.check(VERSION);
    return { ready: report.status === 'ok' };
  }
}
