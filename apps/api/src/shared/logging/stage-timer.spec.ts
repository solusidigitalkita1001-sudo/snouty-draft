import { describe, expect, it } from 'vitest';
import { stageTimer } from './stage-timer.js';

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
