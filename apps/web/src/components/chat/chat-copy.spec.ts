import { describe, expect, it } from 'vitest';
import { CHAT_COPY, CHAT_COPY_EN } from './chat-copy';

describe('judul percakapan dari kebutuhan', () => {
  it('bangunan komersial ringan (toko, kantor, masjid) bukan "Rumah"', () => {
    expect(CHAT_COPY.titleFor('light_commercial', 2)).toBe('Bangunan 2 lantai — konsultasi baru');
    expect(CHAT_COPY.titleFor('residential', 2)).toBe('Rumah 2 lantai — konsultasi baru');
    expect(CHAT_COPY_EN.titleFor('light_commercial', 3)).toBe(
      '3-storey building — new consultation',
    );
  });
});
