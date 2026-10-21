/** P26-02 — sinyal tertulis setelah respons berhasil; kejadian sama di hari sama satu baris. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { lastValueFrom, of, throwError } from 'rxjs';
import { createTestDatabase, type TestDatabase } from '../../../test/mysql.js';
import { prospectSignals } from '../../infrastructure/mysql/schema/intelligence.js';
import { ProspectSignalInterceptor } from './prospect-signal.interceptor.js';
import { PROSPECT_SIGNAL, type SignalSpec } from './prospect-signal.js';

let fixture: TestDatabase;

beforeAll(async () => {
  fixture = await createTestDatabase('prospect_signals');
});
afterAll(async () => {
  await fixture.close();
});
beforeEach(async () => {
  await fixture.clear();
});

function setup(spec: SignalSpec | undefined, request: Record<string, unknown>) {
  const interceptor = new ProspectSignalInterceptor(
    { get: () => spec } as never,
    { db: fixture.db } as never,
    { logger: { warn: vi.fn() } } as never,
  );
  const context = {
    getHandler: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
  return (handled = of({ ok: true })) =>
    lastValueFrom(interceptor.intercept(context, { handle: () => handled }));
}

const rows = async () => {
  // Penulisan berjalan di latar; beri kesempatan selesai.
  await new Promise((resolve) => setTimeout(resolve, 100));
  return fixture.db.select().from(prospectSignals);
};

describe('ProspectSignalInterceptor di MySQL (0026)', () => {
  it('unduhan laporan yang sama dua kali di hari yang sama = satu baris', async () => {
    const run = setup(PROSPECT_SIGNAL.reportDownload, { params: { id: 'R'.repeat(26) } });
    await run();
    await run();
    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      kind: 'report_download',
      refId: 'R'.repeat(26),
      userId: null,
    });
  });

  it('permintaan yang gagal tidak dicatat; rute tanpa dekorator tidak dicatat', async () => {
    const failing = setup(PROSPECT_SIGNAL.reportDownload, { params: { id: 'R'.repeat(26) } });
    await expect(failing(throwError(() => new Error('NOT_FOUND')))).rejects.toThrow('NOT_FOUND');
    await setup(undefined, { params: { id: 'R'.repeat(26) } })();
    expect(await rows()).toHaveLength(0);
  });
});
