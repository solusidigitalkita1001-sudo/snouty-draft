'use client';

/**
 * Lonceng pemberitahuan (P27-07, pemilik 2026-10-23: "notifikasi belum ada").
 *
 * Dipakai di dua tempat dengan komponen yang sama: cangkang dashboard internal (prospek
 * ditugaskan, ada yang minta dihubungi) dan ruang konsultasi (laporan siap). Isinya memang
 * berbeda per orang — yang dilihat seseorang hanyalah yang ditujukan kepadanya.
 *
 * Tamu tidak punya pemberitahuan: API menolak, `fetchNotifications` mengembalikan kosong, dan
 * loncengnya tidak dirender sama sekali — bukan lonceng kosong yang mengundang klik.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '../locale';
import {
  fetchNotifications,
  markNotificationsRead,
  type NotificationFeed,
} from './notification-api';
import { notificationAge, notificationLine, notificationShell } from './notification-copy';
import styles from './notification.module.css';

/** Ditarik ulang berkala; cukup jarang untuk tidak membebani, cukup sering untuk terasa hidup. */
const POLL_MS = 60_000;

export function NotificationBell({ enabled = true }: { readonly enabled?: boolean }) {
  const { locale } = useLocale();
  const COPY = notificationShell(locale);
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    void fetchNotifications().then(setFeed);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  // Klik di luar dan Escape menutup — panelnya melayang, jadi ia harus bisa ditinggalkan.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!enabled || feed === null || (feed.items.length === 0 && feed.unread === 0)) return null;

  const markAll = async () => {
    await markNotificationsRead();
    refresh();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.bell}
        aria-expanded={open}
        aria-label={feed.unread > 0 ? `${COPY.bell}, ${COPY.unread(feed.unread)}` : COPY.bell}
        onClick={() => setOpen((shown) => !shown)}
      >
        <BellIcon />
        {feed.unread > 0 && <span className={styles.badge}>{feed.unread}</span>}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label={COPY.title}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>{COPY.title}</span>
            {feed.unread > 0 && (
              <button type="button" className={styles.markAll} onClick={() => void markAll()}>
                {COPY.markAll}
              </button>
            )}
          </div>
          {feed.items.length === 0 ? (
            <p className={styles.empty}>{COPY.empty}</p>
          ) : (
            <ul className={styles.list}>
              {feed.items.map((item) => {
                const line = notificationLine(item, locale);
                return (
                  <li key={item.id} className={item.read ? styles.item : styles.itemUnread}>
                    <span className={styles.text}>{line.text}</span>
                    <span className={styles.meta}>
                      <span>{notificationAge(item.createdAt, locale)}</span>
                      {line.href !== null && (
                        <a
                          className={styles.openLink}
                          href={line.href}
                          onClick={() => void markNotificationsRead([item.id])}
                        >
                          {COPY.open}
                        </a>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 1 1 12 0c0 3.3.7 5 1.5 6h-15C5.3 14 6 12.3 6 9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
