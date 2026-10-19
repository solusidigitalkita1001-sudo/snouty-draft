'use client';

/**
 * Menu "⋯" pada baris riwayat (P24): sematkan, pindahkan ke proyek, hapus. Tanpa logika bisnis —
 * hanya memanggil handler; tombol hilang di luar hover kecuali di layar sentuh. BELUM DIDESAIN (OQ-72).
 *
 * Menunya dirender lewat portal ke `document.body` dengan posisi tetap terhadap tombol: di dalam
 * sidebar yang bisa digulir, menu absolut terpotong dan tertimpa baris di bawahnya (laporan pemilik
 * 2026-10-19). Membuka ke atas bila ruang di bawah tidak cukup; menggulir menutupnya.
 */
import type { ProjectSummary } from '@snouty/shared-types';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENU_WIDTH = 230;
const GAP = 4;
const EDGE = 8;
import { useLocale } from '../locale';
import { libraryCopy } from './library-copy';
import styles from './library.module.css';

export function RowMenu({
  title,
  pinned,
  projectId,
  projects,
  onPin,
  onMove,
  onDelete,
}: {
  readonly title: string;
  readonly pinned: boolean;
  readonly projectId: string | null;
  readonly projects: readonly ProjectSummary[];
  readonly onPin: (pinned: boolean) => void;
  readonly onMove: (projectId: string | null) => void;
  readonly onDelete: () => void;
}) {
  const COPY = libraryCopy(useLocale().locale);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // Posisi dihitung setelah menu ada di DOM (tingginya baru diketahui saat itu).
  useLayoutEffect(() => {
    if (!open || !button.current) {
      setPosition(null);
      return;
    }
    const rect = button.current.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? 0;
    const below = rect.bottom + GAP;
    const top =
      below + height > window.innerHeight - EDGE && rect.top - GAP - height > EDGE
        ? rect.top - GAP - height
        : below;
    const left = Math.min(
      Math.max(EDGE, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - EDGE,
    );
    setPosition({ top, left });
  }, [open, projects.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrap.current?.contains(target) || menu.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    // Menggulir sidebar atau halaman memindahkan tombol; menu tetap tidak boleh melayang terpisah.
    const onScroll = (event: Event) => {
      if (menu.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className={styles.menuWrap} ref={wrap}>
      <button
        ref={button}
        type="button"
        className={[styles.menuButton, open ? styles.menuButtonOpen : ''].join(' ')}
        aria-label={COPY.menu(title)}
        title={COPY.menu(title)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" fill="currentColor" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
          <circle cx="19" cy="12" r="1.8" fill="currentColor" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            className={styles.menu}
            role="menu"
            style={{
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width: MENU_WIDTH,
              visibility: position ? 'visible' : 'hidden',
            }}
          >
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={act(() => onPin(!pinned))}
            >
              {pinned ? COPY.unpin : COPY.pin}
            </button>
            <div className={styles.menuSep} />
            <div className={styles.menuLabel}>{COPY.moveTo.toUpperCase()}</div>
            {projects.length === 0 && <div className={styles.empty}>{COPY.noProjects}</div>}
            {projects
              .filter((p) => p.id !== projectId)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={act(() => onMove(p.id))}
                >
                  {p.name}
                </button>
              ))}
            {projectId !== null && (
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={act(() => onMove(null))}
              >
                {COPY.removeFromProject}
              </button>
            )}
            <div className={styles.menuSep} />
            <button
              type="button"
              role="menuitem"
              className={[styles.menuItem, styles.menuDanger].join(' ')}
              onClick={act(onDelete)}
            >
              {COPY.delete}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
