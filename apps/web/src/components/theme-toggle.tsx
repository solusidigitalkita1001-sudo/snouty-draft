'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'snouty-theme';

/**
 * Pengalih tema untuk halaman pratinjau.
 *
 * Skeleton ini menyimpan pilihan di localStorage saja. Pada produk sebenarnya,
 * server yang berwenang untuk pengguna terdaftar dan localStorage hanya
 * kenyamanan render pertama (OQ-19) — belum relevan karena autentikasi baru
 * ada di Fase 3.
 */
/**
 * Tema awal sebelum React: skrip ini dipasang inline di `layout.tsx` supaya halaman tidak
 * berkedip terang lalu gelap. Pilihan tersimpan menang; tanpa pilihan, ikuti sistem.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.dataset.theme='dark';}catch(e){}})();`;

export function ThemeToggle({ compact = false }: { readonly compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Sumber kebenaran saat mount adalah atribut yang sudah dipasang skrip init.
    setTheme(document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset['theme'] = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Penyimpanan diblokir (mode privat): tema tetap berganti untuk sesi ini.
    }
  }

  const label = theme === 'dark' ? 'Mode terang' : 'Mode gelap';

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={theme === 'dark'}
        aria-label={label}
        title={label}
        style={{
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--snouty-muted)',
          background: 'var(--snouty-surface)',
          border: '1px solid var(--snouty-border)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === 'dark'}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 'var(--snouty-text-helper)',
        color: 'var(--snouty-ink-4)',
        background: 'var(--snouty-surface)',
        border: '1px solid var(--snouty-border)',
        borderRadius: 'var(--snouty-radius-pill)',
        padding: '6px 11px',
        cursor: 'pointer',
        minHeight: 'var(--snouty-tap-min)',
      }}
    >
      <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span>
      <span>{theme === 'dark' ? 'Terang' : 'Gelap'}</span>
    </button>
  );
}
