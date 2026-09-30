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
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial: Theme = stored === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    document.documentElement.dataset['theme'] = initial;
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset['theme'] = next;
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === 'dark'}
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
