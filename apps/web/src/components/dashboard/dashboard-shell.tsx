'use client';

/**
 * Cangkang dashboard internal (P26-08, pemilik 2026-10-21: "pake sidebar ae"). Navigasi di sidebar —
 * tiap bagian punya alamatnya sendiri, jadi bisa ditandai dan dibagikan antar orang internal.
 *
 * Menu mengikuti peran yang dipegang akun, sebagai TAMPILAN saja: aksesnya selalu diperiksa API
 * (`InternalRoleGuard`). Mascot tidak dipakai di back-office (skill desain).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { canOpenDashboard, getCurrentUser, isSales, restoreSession } from '../auth/session';
import { useLocale } from '../locale';
import { dashboardCopy } from './dashboard-copy';
import { BackIcon, MenuIcon, sectionIcon } from './dashboard-icons';
import styles from './dashboard.module.css';

export type DashboardSection = 'prospects' | 'team' | 'market' | 'leads';

interface NavItem {
  readonly section: DashboardSection;
  readonly href: string;
  readonly label: string;
  readonly show: boolean;
}

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
  const items: readonly NavItem[] = [
    {
      section: 'prospects',
      href: '/internal/prospects',
      label: COPY.nav.prospects,
      show: canOpenDashboard(user),
    },
    {
      section: 'leads',
      href: '/internal/leads',
      label: COPY.nav.leads,
      show: isSales(user) || canOpenDashboard(user),
    },
    {
      section: 'market',
      href: '/internal/market',
      label: COPY.nav.market,
      show: canOpenDashboard(user),
    },
    {
      section: 'team',
      href: '/internal/sales-team',
      label: COPY.nav.team,
      show: canOpenDashboard(user),
    },
  ];
  // Sebelum sesi terbaca, bagian yang sedang dibuka tetap tampil supaya menu tidak berkedip kosong.
  const shown = items.filter((item) => item.show || item.section === section);

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
        </nav>
        <div className={styles.sidebarFoot}>
          {user && <span className={styles.meta}>{user.name}</span>}
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
