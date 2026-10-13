/** Review putaran 3, 6c: label di dalam sprite tidak boleh terbaca sebagai teks halaman. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IllustrationSprite } from './illustration';

describe('IllustrationSprite', () => {
  it('disembunyikan dengan display:none, jadi "KOS"/"HOTEL" tidak ikut teks halaman', () => {
    const html = renderToStaticMarkup(<IllustrationSprite />);
    expect(html).toMatch(/^<svg[^>]*style="position:absolute;display:none"/);
    expect(html).toContain('aria-hidden="true"');
  });
});
