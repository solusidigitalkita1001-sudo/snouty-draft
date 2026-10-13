/** Ilustrasi tidak memuat tulisan yang mengulang label di sampingnya (review 0015: "PDAM PDAM"). */
import { describe, expect, it } from 'vitest';
import { illustrationSpriteContent } from './illustrations.js';

describe('sprite ilustrasi', () => {
  it('gambar meteran tanpa tulisan PDAM', () => {
    const meter = /<symbol id="il-meter"[\s\S]*?<\/symbol>/.exec(illustrationSpriteContent())![0];
    expect(meter).not.toContain('PDAM');
  });
});
