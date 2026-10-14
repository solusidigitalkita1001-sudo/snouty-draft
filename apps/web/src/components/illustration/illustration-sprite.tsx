'use client';

import { useSyncExternalStore } from 'react';
import { illustrationSpriteContent } from '@snouty/ui/illustrations';

const noop = (): (() => void) => () => undefined;

/**
 * Dipasang sekali di layout. Isinya string statis milik kita, bukan masukan pengguna.
 *
 * Simbolnya hanya diisi di browser (review putaran 4, poin 2): label di dalam gambar ("KOS",
 * "HOTEL", "0 %", "semua sekaligus?") dulu ikut terkirim di HTML server dan terbaca sebagai teks
 * halaman oleh crawler dan pembaca teks, walau sprite `display:none`. Gambar dipakai lewat `<use>`
 * setelah hidrasi, jadi tidak ada yang hilang dari tampilan.
 */
export function IllustrationSprite() {
  const inBrowser = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: 'absolute', display: 'none' }}
      dangerouslySetInnerHTML={{ __html: inBrowser ? illustrationSpriteContent() : '' }}
    />
  );
}
