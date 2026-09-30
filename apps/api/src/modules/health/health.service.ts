import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../shared/database/database.service.js';

export type DependencyStatus = 'up' | 'down';

export interface HealthReport {
  readonly status: 'ok' | 'degraded';
  readonly db: DependencyStatus;
  readonly version: string;
}

/** Dependensi yang bisa di-ping. Interface ini yang membuat service dapat diuji tanpa MySQL. */
export interface Pingable {
  ping(): Promise<boolean>;
}

@Injectable()
export class HealthService {
  constructor(private readonly db: Pingable) {}

  /**
   * Kegagalan database tidak pernah melempar galat driver mentah ke klien.
   * Ia dilaporkan sebagai `db: 'down'` dengan status `degraded`
   * (docs/DATABASE.md §7).
   */
  async check(version: string): Promise<HealthReport> {
    const db: DependencyStatus = (await this.isReachable()) ? 'up' : 'down';
    return { status: db === 'up' ? 'ok' : 'degraded', db, version };
  }

  private async isReachable(): Promise<boolean> {
    try {
      await this.db.ping();
      return true;
    } catch {
      // Sengaja ditelan: galat driver tidak pernah sampai ke klien, dan
      // ketidaktersediaan database sudah terwakili oleh db: 'down'.
      return false;
    }
  }
}

/** Factory untuk DI Nest — service-nya sendiri hanya bergantung pada `Pingable`. */
export const healthServiceProvider = {
  provide: HealthService,
  inject: [DatabaseService],
  useFactory: (db: DatabaseService) => new HealthService(db),
};
