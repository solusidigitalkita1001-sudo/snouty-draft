/**
 * Mascot: setiap mood bisa digambar, `fail` tidak diulang (lembar mascot §7), dan
 * komponennya dekoratif — tidak pernah membawa teks yang dibaca pembaca layar.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MOODS } from './mood';
import { Snouty, SnoutyAvatar } from './snouty';

describe('Snouty', () => {
  it('menggambar ketiga belas mood tanpa melempar, dengan kedua PNG', () => {
    for (const mood of MOODS) {
      const { container, unmount } = render(<Snouty mood={mood} size={104} />);
      const sources = Array.from(container.querySelectorAll('img')).map((img) =>
        img.getAttribute('src'),
      );
      expect(sources).toEqual(['/snouty-base.png', '/snouty-pencil.png']);
      expect(container.firstElementChild?.getAttribute('data-mood')).toBe(mood);
      unmount();
    }
  });

  it('fail diputar sekali lalu diam; mood lain mengulang', () => {
    const body = (mood: 'fail' | 'idle') => {
      const { container } = render(<Snouty mood={mood} size={84} />);
      return (container.firstElementChild!.firstElementChild as HTMLElement).style.animation;
    };
    expect(body('fail')).toContain('1 forwards');
    expect(body('fail')).not.toContain('infinite');
    expect(body('idle')).toContain('infinite');
  });

  it('dekoratif: aria-hidden, tanpa teks aksesibel', () => {
    const { container } = render(<Snouty mood="idle" size={56} />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('avatar memperbesar mascot 1,9× di dalam kotak seukuran yang diminta', () => {
    const { container } = render(<SnoutyAvatar mood="think" size={30} />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.width).toBe('30px');
    const mascot = box.querySelector('[data-mood="think"]') as HTMLElement;
    expect(mascot.style.width).toBe('57px');
  });
});
