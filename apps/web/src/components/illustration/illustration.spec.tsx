/** Review putaran 3 (6c) dan 4 (poin 2): label di dalam sprite tidak boleh terbaca sebagai teks halaman. */
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IllustrationSprite } from './illustration';

describe('IllustrationSprite', () => {
  it('HTML server tidak memuat simbol, jadi "KOS"/"semua sekaligus" tidak ikut teks halaman', () => {
    const html = renderToString(<IllustrationSprite />);
    expect(html).toMatch(/^<svg[^>]*style="position:absolute;display:none"/);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<symbol');
    expect(html).not.toContain('semua sekaligus');
  });

  it('di browser simbolnya terpasang untuk dipakai lewat <use>', () => {
    const { container } = render(<IllustrationSprite />);
    expect(container.querySelectorAll('symbol').length).toBeGreaterThan(0);
  });
});
