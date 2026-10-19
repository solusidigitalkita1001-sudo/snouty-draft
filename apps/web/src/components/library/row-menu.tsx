'use client';

/**
 * Menu "⋯" pada baris riwayat (P24): sematkan, pindahkan ke proyek, hapus. Tanpa logika bisnis —
 * hanya memanggil handler; tombol hilang di luar hover kecuali di layar sentuh. BELUM DIDESAIN (OQ-72).
 */
import type { ProjectSummary } from '@snouty/shared-types';
import { useEffect, useRef, useState } from 'react';
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
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className={styles.menuWrap} ref={wrap}>
      <button
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
      {open && (
        <div className={styles.menu} role="menu">
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
        </div>
      )}
    </div>
  );
}
