import { describe, expect, it } from 'vitest';
import { stageTimer, streamStageClock } from './stage-timer.js';

describe('stageTimer', () => {
  it('durasi per tahap sejak mark sebelumnya; total sejak dibuat', () => {
    const ticks = [1000, 1010, 1250, 1300, 1301];
    let i = 0;
    const timer = stageTimer(() => ticks[i++]!);
    timer.mark('load');
    timer.mark('route');
    timer.mark('answer');
    expect(timer.report()).toEqual({ load: 10, route: 240, answer: 50, total: 301 });
  });
});

describe('streamStageClock', () => {
  it('durasi tahap dari event active → done; tahap tanpa active diabaikan', () => {
    const ticks = [0, 5, 105, 110, 400, 401];
    let i = 0;
    const clock = streamStageClock(() => ticks[i++]!);
    clock.observe({ type: 'stage', stage: 'ANALYZING_INSTALLATION', status: 'active' });
    clock.observe({ type: 'stage', stage: 'ANALYZING_INSTALLATION', status: 'done' });
    clock.observe({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'active' });
    clock.observe({ type: 'stage', stage: 'MATCHING_PRODUCTS', status: 'done' });
    clock.observe({ type: 'stage', stage: 'PREPARING_SCHEMATIC', status: 'done' });
    clock.observe({ type: 'token' });
    expect(clock.report()).toEqual({
      ANALYZING_INSTALLATION: 100,
      MATCHING_PRODUCTS: 290,
      total: 401,
    });
  });
});
