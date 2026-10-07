/**
 * P14-07 — event mengalir saat di-push, urutannya sama dengan array hasil; header SSE baru
 * ditulis pada event pertama.
 */
import { describe, expect, it } from 'vitest';
import type { AssistantStreamEvent } from '@snouty/shared-types';
import { sseWriter, streamedEvents } from './event-stream.js';

const start: AssistantStreamEvent = { type: 'message.start', messageId: 'M' };
const stage: AssistantStreamEvent = { type: 'stage', stage: 'UNDERSTANDING', status: 'active' };

describe('streamedEvents', () => {
  it('setiap push langsung sampai ke sink, dan array tetap lengkap berurutan', () => {
    const seen: AssistantStreamEvent[] = [];
    const events = streamedEvents((e) => seen.push(e), [start]);
    expect(seen).toEqual([start]);
    events.push(stage);
    expect(seen).toEqual([start, stage]);
    expect(events).toEqual([start, stage]);
  });

  it('tanpa sink: array biasa', () => {
    const events = streamedEvents(undefined, [start]);
    events.push(stage);
    expect(events).toEqual([start, stage]);
  });
});

describe('sseWriter', () => {
  it('header dikirim sekali pada event pertama; sebelum itu tidak ada byte', () => {
    const headers: string[] = [];
    const chunks: string[] = [];
    let flushed = 0;
    const writer = sseWriter({
      setHeader: (n, v) => headers.push(`${n}=${v}`),
      flushHeaders: () => (flushed += 1),
      write: (c) => chunks.push(c),
    });
    expect(writer.started()).toBe(false);
    writer.emit(start);
    writer.emit(stage);
    expect(flushed).toBe(1);
    expect(headers[0]).toBe('content-type=text/event-stream');
    expect(chunks).toEqual([
      'event: message.start\n',
      `data: ${JSON.stringify(start)}\n\n`,
      'event: stage\n',
      `data: ${JSON.stringify(stage)}\n\n`,
    ]);
    expect(writer.written()).toBe(2);
  });
});
