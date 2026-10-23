'use client';

/**
 * Cangkang back-office. **BELUM DIDESAIN (OQ-21)** — dibangun minimal dan ditandai.
 *
 * Setiap bagian menyebut **apa yang sudah siap di API** dan **apa yang menunggu jawaban
 * mana**. Itu bukan pengisi tempat: orang internal yang membuka halaman ini perlu tahu
 * apakah fitur belum ada atau sedang menunggu keputusan — dan halaman kosong tanpa
 * penjelasan membuat keduanya terlihat sama.
 *
 * Mascot sengaja tidak dipakai di sini (skill desain): ini alat kerja, bukan permukaan produk.
 */

import { internalCopy, type InternalSection } from './internal-copy';
import { useLocale } from '../locale';
import { useEffect, useState } from 'react';
import { getCurrentUser, restoreSession } from '../auth/session';
import { boardLinks } from './back-office-nav';
import styles from './internal.module.css';

/** Teks UI mengikuti bahasa yang dipilih (Fase 15). */
function useInternalCopy() {
  return internalCopy(useLocale().locale);
}

export function InternalShell({ section }: { section: InternalSection }) {
  const COPY = useInternalCopy();
  const { locale } = useLocale();
  const content = COPY[section];
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void restoreSession().finally(() => setReady(true));
  }, []);
  // Jalan kembali ke papan prospek (P28-04): dari sini dulu tidak ada satu pun tautan ke sana.
  const board = boardLinks(ready ? getCurrentUser() : null, locale);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>{COPY.brand}</div>
        <nav className={styles.nav}>
          {COPY.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={[
                styles.navItem,
                item.label === content.title ? styles.navActive : '',
              ].join(' ')}
            >
              <span>{item.label}</span>
              <span className={styles.navPhase}>{item.phase}</span>
            </a>
          ))}
          {board.length > 0 && (
            <>
              <span className={styles.navGroup}>{COPY.boardGroup}</span>
              {board.map((item) => (
                <a key={item.section} href={item.href} className={styles.navItem}>
                  <span>{item.label}</span>
                </a>
              ))}
            </>
          )}
        </nav>
      </aside>

      <main className={styles.main}>
        {/* Tanpa syarat — lihat alasannya di DESIGN_IMPLEMENTATION §13. */}
        <div className={styles.needsDesign}>{COPY.needsDesign}</div>

        <h1 className={styles.title}>{content.title}</h1>
        <p className={styles.body}>{content.body}</p>

        <div className={styles.blockedCard}>
          <span className={styles.blockedTag}>{COPY.statusLabel.blocked}</span>
          <p className={styles.blockedBody}>{content.blocked}</p>
        </div>
      </main>
    </div>
  );
}
