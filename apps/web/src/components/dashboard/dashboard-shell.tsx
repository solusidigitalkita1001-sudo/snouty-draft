'use client';

/**
 * Cangkang dashboard internal (P26-08, pemilik 2026-10-21: "pake sidebar ae"). Navigasi di sidebar —
 * tiap bagian punya alamatnya sendiri, jadi bisa ditandai dan dibagikan antar orang internal.
 *
 * Menu mengikuti peran yang dipegang akun, sebagai TAMPILAN saja: aksesnya selalu diperiksa API
 * (`InternalRoleGuard`). Mascot tidak dipakai di back-office (skill desain).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, restoreSession } from '../auth/session';
import { useLocale } from '../locale';
import { dashboardCopy } from './dashboard-copy';
import { NotificationBell } from '../notification/notification-bell';
import { BackIcon, MenuIcon, sectionIcon } from './dashboard-icons';
import { boardLinks, toolLinks, type BoardSection } from '../internal/back-office-nav';
import styles from './dashboard.module.css';

/** Tetap diekspor: dipakai halaman-halaman papan untuk menyebut bagiannya. */
export type DashboardSection = BoardSection;

export function DashboardShell({
  section,
  children,
}: {
  section: DashboardSection;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const COPY = dashboardCopy(locale);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  // Sesi dipulihkan sekali di sini supaya tiap bagian tidak melakukannya sendiri.
  useEffect(() => {
    void restoreSession().finally(() => setReady(true));
  }, []);

  const user = ready ? getCurrentUser() : null;
  // Satu navigasi untuk seluruh back-office (P28-04): papan prospek DAN alat internal. Dulu
  // keduanya sidebar terpisah yang tidak saling menyebut, dan layar katalog tidak punya satu pun
  // tautan dari dalam aplikasi — hanya bisa dibuka dengan mengetik alamatnya.
  const board = boardLinks(user, locale);
  const tools = toolLinks(user, locale);
  // Sebelum sesi terbaca, bagian yang sedang dibuka tetap tampil supaya menu tidak berkedip kosong.
  const shown = board.some((item) => item.section === section)
    ? board
    : [...board, { section, href: '#', label: COPY.nav[section] }];

  return (
    <div className={styles.shell}>
      <aside className={[styles.sidebar, open ? styles.sidebarOpen : ''].join(' ')}>
        <div className={styles.sidebarHead}>
          <span className={styles.brand}>{COPY.brand}</span>
          <span className={styles.brandKicker}>{COPY.kicker}</span>
        </div>
        <nav className={styles.nav} aria-label={COPY.kicker}>
          {shown.map((item) => (
            <a
              key={item.section}
              href={item.href}
              className={[styles.navItem, item.section === section ? styles.navOn : ''].join(' ')}
              aria-current={item.section === section ? 'page' : undefined}
            >
              {sectionIcon(item.section)}
              <span>{item.label}</span>
            </a>
          ))}
          {tools.length > 0 && (
            <>
              <span className={styles.navGroup}>{COPY.nav.tools}</span>
              {tools.map((item) => (
                <a key={item.section} href={item.href} className={styles.navItem}>
                  {sectionIcon(item.section)}
                  <span>{item.label}</span>
                </a>
              ))}
            </>
          )}
        </nav>
        <div className={styles.sidebarFoot}>
          <div className={styles.footRow}>
            {user && <span className={styles.meta}>{user.name}</span>}
            {/* Penugasan prospek dan permintaan dihubungi sampai ke sini (P27-07). Loncengnya
                duduk di kaki sidebar, jadi panelnya naik — ke bawah ia jatuh keluar layar. */}
            <NotificationBell enabled={user !== null} placement="above" />
          </div>
          <a className={styles.backLink} href="/consultation">
            <BackIcon />
            <span>{COPY.nav.back}</span>
          </a>
        </div>
      </aside>

      <div className={styles.content}>
        {/* Di layar sempit sidebar menjadi panel yang dibuka dari tombol ini. */}
        <button
          type="button"
          className={styles.navToggle}
          aria-expanded={open}
          onClick={() => setOpen((shownNow) => !shownNow)}
        >
          <MenuIcon open={open} />
          <span>{open ? COPY.nav.close : COPY.nav.menu}</span>
        </button>
        <main className={styles.main}>
          {ready ? children : <p className={styles.muted}>{COPY.loading}</p>}
        </main>
      </div>
    </div>
  );
}
