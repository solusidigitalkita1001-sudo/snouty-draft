'use client';

/**
 * Layar kosong back-office (P26-11, pemilik 2026-10-21: "tambahin beberapa maskotnya juga"). Maskot
 * dipakai TERBATAS — hanya saat tidak ada yang bisa ditampilkan — supaya dashboard tetap terbaca
 * sebagai alat kerja. Ia hiasan: `aria-hidden`, kalimatnya yang membawa makna.
 */
import { Snouty } from '../mascot/snouty';
import type { Mood } from '../mascot/mood';
import styles from './dashboard.module.css';

export function EmptyState({ mood, text }: { mood: Mood; text: string }) {
  return (
    <div className={styles.emptyState}>
      <span aria-hidden="true">
        <Snouty mood={mood} size={64} />
      </span>
      <p className={styles.muted}>{text}</p>
    </div>
  );
}
