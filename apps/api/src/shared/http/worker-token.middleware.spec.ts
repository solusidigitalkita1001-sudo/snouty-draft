/**
 * OQ-49 — token layanan worker mengisi aktor, tidak pernah menolak.
 */
import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import type { WithInternalActor } from './internal-role.guard.js';
import { WORKER_ACTOR, WorkerTokenMiddleware } from './worker-token.middleware.js';

const TOKEN = 'token-worker-yang-cukup-panjang-untuk-skema-env';

// `configured` tidak memakai nilai baku parameter: `undefined` eksplisit harus berarti
// "token tidak diset di env", bukan jatuh ke TOKEN.
function run(authorization: string | undefined, ...configured: [string | undefined] | []) {
  const middleware = new WorkerTokenMiddleware(configured.length === 0 ? TOKEN : configured[0]);
  const request = { headers: { authorization } } as Request & WithInternalActor;
  let nexted = false;
  middleware.use(
    request,
    {} as Response,
    (() => {
      nexted = true;
    }) as NextFunction,
  );
  return { request, nexted };
}

describe('WorkerTokenMiddleware', () => {
  it('mengisi aktor layanan `worker` berperan admin bila token cocok', () => {
    const { request, nexted } = run(`Bearer ${TOKEN}`);

    expect(request.internalActor).toBe(WORKER_ACTOR);
    expect(request.internalActor).toEqual({ id: 'worker', roles: ['admin'] });
    expect(nexted).toBe(true);
  });

  it('membiarkan permintaan tanpa token lewat sebagai anonim — guard yang menolak', () => {
    const { request, nexted } = run(undefined);

    expect(request.internalActor).toBeUndefined();
    expect(nexted).toBe(true);
  });

  it('token yang salah, termasuk yang hanya beda panjang, tidak mengisi aktor', () => {
    expect(run(`Bearer ${TOKEN}x`).request.internalActor).toBeUndefined();
    expect(run(`Bearer ${TOKEN.slice(0, -1)}`).request.internalActor).toBeUndefined();
    expect(run(`Bearer ${'x'.repeat(TOKEN.length)}`).request.internalActor).toBeUndefined();
  });

  it('hanya skema Bearer yang dibaca', () => {
    expect(run(`Basic ${TOKEN}`).request.internalActor).toBeUndefined();
    expect(run(TOKEN).request.internalActor).toBeUndefined();
  });

  it('tanpa WORKER_INTERNAL_TOKEN di env, tidak ada token yang pernah cocok', () => {
    expect(run(`Bearer ${TOKEN}`, undefined).request.internalActor).toBeUndefined();
    expect(run('Bearer undefined', undefined).request.internalActor).toBeUndefined();
  });

  it('aktor worker tidak bisa diubah oleh handler setelahnya', () => {
    expect(Object.isFrozen(WORKER_ACTOR)).toBe(true);
    expect(Object.isFrozen(WORKER_ACTOR.roles)).toBe(true);
  });
});
