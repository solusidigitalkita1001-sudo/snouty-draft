/** P26-07 — event pasar hanya setelah rute bertanda berhasil, dengan id percakapan yang sah. */
import { describe, expect, it, vi } from 'vitest';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { MarketSignalSpec } from '../../../shared/market/market-signal.js';
import { MarketEventInterceptor } from './market-event.interceptor.js';

const ID = '01JC0NV00000000000000000AB';

function run(spec: MarketSignalSpec | undefined, params: Record<string, string>, ok = true) {
  const market = { record: vi.fn(async () => undefined) };
  const interceptor = new MarketEventInterceptor({ get: () => spec } as never, market as never);
  const context = {
    getHandler: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ params, ip: '36.66.0.1' }) }),
  } as never;
  const handled = ok ? of(null) : throwError(() => new Error('gagal'));
  return { market, done: lastValueFrom(interceptor.intercept(context, { handle: () => handled })) };
}

describe('MarketEventInterceptor (P26-07)', () => {
  it('solusi berhasil → satu pencatatan dengan IP permintaan', async () => {
    const { market, done } = run({ trigger: 'solution', param: 'id' }, { id: ID });
    await done;
    expect(market.record).toHaveBeenCalledWith(ID, 'solution', '36.66.0.1');
  });

  it('rute gagal, rute tanpa tanda, atau id tidak sah → tidak dicatat', async () => {
    const failed = run({ trigger: 'solution', param: 'id' }, { id: ID }, false);
    await expect(failed.done).rejects.toThrow('gagal');
    const unmarked = run(undefined, { id: ID });
    await unmarked.done;
    const bad = run({ trigger: 'technical', param: 'id' }, { id: '../etc' });
    await bad.done;
    for (const { market } of [failed, unmarked, bad]) expect(market.record).not.toHaveBeenCalled();
  });
});
