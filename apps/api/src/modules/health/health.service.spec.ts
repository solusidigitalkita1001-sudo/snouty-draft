import { describe, expect, it } from 'vitest';
import { HealthService, type Pingable } from './health.service.js';

const up: Pingable = { ping: async () => true };
const down: Pingable = {
  ping: async () => {
    throw new Error('ECONNREFUSED');
  },
};

describe('HealthService', () => {
  it('melaporkan ok saat database dapat dijangkau', async () => {
    const report = await new HealthService(up).check('1.2.3');
    expect(report).toEqual({ status: 'ok', db: 'up', version: '1.2.3' });
  });

  it('melaporkan degraded, bukan melempar, saat database mati', async () => {
    const report = await new HealthService(down).check('1.2.3');
    expect(report.status).toBe('degraded');
    expect(report.db).toBe('down');
  });

  it('tidak membocorkan galat driver ke dalam laporan', async () => {
    const report = await new HealthService(down).check('1.2.3');
    expect(JSON.stringify(report)).not.toContain('ECONNREFUSED');
  });
});
