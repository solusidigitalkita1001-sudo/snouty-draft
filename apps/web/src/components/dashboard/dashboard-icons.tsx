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

/** Penanda lokasi: judul peta permintaan. */
export function MapPinIcon() {
  return (
    <Icon>
      <path d="M10 17s5-4.6 5-8.4A5 5 0 0 0 5 8.6C5 12.4 10 17 10 17z" />
      <circle cx="10" cy="8.5" r="1.8" />
    </Icon>
  );
}

/** Kaca pembesar dengan tanda kurang: kembali ke seluruh peta. */
export function ZoomOutIcon() {
  return (
    <Icon>
      <circle cx="9" cy="9" r="5" />
      <path d="M6.8 9h4.4M13 13l4 4" />
    </Icon>
  );
}

/** Tahap 5A, satu ikon per tahap — pelengkap label, bukan pengganti. */
export function StageIcon({ stage }: { stage: string }) {
  if (stage === 'aware') {
    return (
      <Icon>
        <path d="M2.5 10S5.5 5.5 10 5.5 17.5 10 17.5 10 14.5 14.5 10 14.5 2.5 10 2.5 10z" />
        <circle cx="10" cy="10" r="2" />
      </Icon>
    );
  }
  if (stage === 'appeal') {
    return (
      <Icon>
        <path d="M10 16s-5.5-3.6-5.5-7a3 3 0 0 1 5.5-1.7A3 3 0 0 1 15.5 9c0 3.4-5.5 7-5.5 7z" />
      </Icon>
    );
  }
  if (stage === 'ask') {
    return (
      <Icon>
        <path d="M7.6 7.6a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.4" />
        <path d="M10 15.2h.01" />
        <circle cx="10" cy="10" r="7.5" />
      </Icon>
    );
  }
  if (stage === 'act') {
    return (
      <Icon>
        <path d="M3 4h2l1.6 8.2a1.5 1.5 0 0 0 1.5 1.2h6.1a1.5 1.5 0 0 0 1.5-1.2L17 7H6" />
        <circle cx="8.5" cy="16.5" r="1" />
        <circle cx="14.5" cy="16.5" r="1" />
      </Icon>
    );
  }
  return (
    <Icon>
      <path d="M4 8.5v3a1.5 1.5 0 0 0 1.5 1.5H7l5 3V5.5l-5 3H5.5A1.5 1.5 0 0 0 4 10z" />
      <path d="M14.5 8a3 3 0 0 1 0 4" />
    </Icon>
  );
}

/** Dasar kontak: minta dihubungi (telepon), mengizinkan (centang), belum (garis). */
export function ContactIcon({ kind }: { kind: 'requested' | 'consent' | 'none' }) {
  if (kind === 'requested') {
    return (
      <Icon>
        <path d="M6.2 3.5 8 7l-1.6 1.6a9 9 0 0 0 4 4L12 11l3.5 1.8v2.7a1 1 0 0 1-1.1 1A12.5 12.5 0 0 1 3.5 5.6a1 1 0 0 1 1-1.1z" />
      </Icon>
    );
  }
  if (kind === 'consent') {
    return (
      <Icon>
        <circle cx="10" cy="10" r="7" />
        <path d="M6.8 10.2l2.2 2.2 4.2-4.6" />
      </Icon>
    );
  }
  return (
    <Icon>
      <circle cx="10" cy="10" r="7" />
      <path d="M6.8 10h6.4" />
    </Icon>
  );
}

/** Proyek: rumah, gedung, kawasan. */
export function ScaleIcon({ scale }: { scale: string }) {
  if (scale === 'district') {
    return (
      <Icon>
        <path d="M3 17h14" />
        <path d="M4.5 17V9l3-2 3 2v8" />
        <path d="M11.5 17v-5l2-1.5 2 1.5v5" />
      </Icon>
    );
  }
  if (scale === 'building') {
    return (
      <Icon>
        <path d="M5.5 17V4.5h9V17" />
        <path d="M8 7.5h1.5M11 7.5h1.5M8 10.5h1.5M11 10.5h1.5M8 13.5h4" />
        <path d="M3 17h14" />
      </Icon>
    );
  }
  return (
    <Icon>
      <path d="M4 9.5 10 4.5l6 5" />
      <path d="M5.8 9v7.5h8.4V9" />
      <path d="M8.8 16.5v-4h2.4v4" />
    </Icon>
  );
}

export function SearchIcon() {
  return (
    <Icon>
      <circle cx="9" cy="9" r="5" />
      <path d="M13 13l4 4" />
    </Icon>
  );
}

export function ChatIcon() {
  return (
    <Icon>
      <path d="M4 5.5h12v8H8.5L5 16.5V13.5H4z" />
    </Icon>
  );
}
