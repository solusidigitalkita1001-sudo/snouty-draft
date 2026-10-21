/**
 * Ikon menu back-office (P26-08). Garis 1,5px dengan `currentColor` supaya ikut warna barisnya dan ikut
 * mode gelap tanpa aset kedua. Semuanya `aria-hidden`: label teks di sebelahnya yang membawa makna —
 * ikon tidak pernah menjadi satu-satunya penanda.
 */
import type { DashboardSection } from './dashboard-shell';

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Corong: tahap 5A yang menyempit. */
export function FunnelIcon() {
  return (
    <Icon>
      <path d="M3 4h14l-5.5 6.5V16L8.5 14v-3.5z" />
    </Icon>
  );
}

/** Satu orang: prospek yang ditugaskan ke sales ini. */
export function PersonIcon() {
  return (
    <Icon>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5" />
    </Icon>
  );
}

/** Batang naik: agregat pasar. */
export function ChartIcon() {
  return (
    <Icon>
      <path d="M3 17h14" />
      <path d="M6 17v-5M10 17V7M14 17v-8" />
    </Icon>
  );
}

/** Dua orang: tim sales. */
export function TeamIcon() {
  return (
    <Icon>
      <circle cx="7.5" cy="7.5" r="2.5" />
      <path d="M3 16.5c0-2.4 2-3.6 4.5-3.6s4.5 1.2 4.5 3.6" />
      <path d="M13 5.5a2.5 2.5 0 0 1 0 5M14.5 13c1.6.4 2.5 1.6 2.5 3.5" />
    </Icon>
  );
}

export function BackIcon() {
  return (
    <Icon>
      <path d="M11 5l-5 5 5 5" />
      <path d="M6 10h9" />
    </Icon>
  );
}

export function MenuIcon({ open }: { open: boolean }) {
  return (
    <Icon>
      {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />}
    </Icon>
  );
}

export function sectionIcon(section: DashboardSection) {
  if (section === 'prospects') return <FunnelIcon />;
  if (section === 'leads') return <PersonIcon />;
  if (section === 'market') return <ChartIcon />;
  return <TeamIcon />;
}
