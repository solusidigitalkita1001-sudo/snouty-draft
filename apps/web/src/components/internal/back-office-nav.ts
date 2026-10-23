/**
 * Satu daftar navigasi back-office (P28-04).
 *
 * Sebelum ini back-office punya DUA sidebar yang tidak saling menyebut: cangkang dashboard
 * (prospek, prospek saya, pasar, tim sales) dan cangkang internal (katalog, validasi aturan,
 * peninjauan email, antrean teknis). Dari yang satu tidak ada jalan ke yang lain, dan separuh
 * "alat" itu tidak punya satu pun tautan dari dalam aplikasi — layar katalog hanya bisa dibuka
 * dengan mengetik alamatnya. Ketahuan saat layarnya dibuka satu per satu (P28-03).
 *
 * Perannya dipakai sebagai TAMPILAN saja; aksesnya tetap diperiksa API (`InternalRoleGuard`).
 * Yang tidak boleh dibuka tidak ditampilkan — tautan yang menjanjikan layar lalu ditolak lebih
 * membingungkan daripada menu yang pendek.
 */
import type { Locale } from '@snouty/shared-types';
import { canOpenDashboard, isSales, type CurrentUser } from '../auth/session';
import { dashboardCopy } from '../dashboard/dashboard-copy';
import { internalCopy } from './internal-copy';

/** Bagian papan prospek — punya ikon dan layar penuhnya sendiri. */
export type BoardSection = 'prospects' | 'leads' | 'market' | 'team';
/** Alat internal — layarnya masih minimal dan bertanda "menunggu desain" (OQ-21). */
export type ToolSection = 'catalog' | 'rules' | 'email' | 'handoff';
export type BackOfficeSection = BoardSection | ToolSection;

export interface BackOfficeLink {
  readonly section: BackOfficeSection;
  readonly href: string;
  readonly label: string;
}

/**
 * Peran yang boleh melihat tiap alat. Katalog dan antrean teknis mengikuti PERSIS apa yang
 * dituntut API-nya (`RequiresRole`), supaya menunya tidak pernah menjanjikan layar yang lalu
 * ditolak. Validasi aturan dan peninjauan email belum punya API, jadi daftarnya menyebut siapa
 * yang memang bekerja di sana.
 */
const TOOL_ROLES: Readonly<Record<ToolSection, readonly string[]>> = {
  catalog: ['catalog_admin'],
  rules: ['domain_expert', 'admin'],
  email: ['sales_reviewer', 'admin'],
  handoff: ['admin'],
};

export function boardLinks(user: CurrentUser | null, locale: Locale): readonly BackOfficeLink[] {
  const COPY = dashboardCopy(locale);
  const board = canOpenDashboard(user);
  const links: readonly (BackOfficeLink & { readonly show: boolean })[] = [
    { section: 'prospects', href: '/internal/prospects', label: COPY.nav.prospects, show: board },
    {
      section: 'leads',
      href: '/internal/leads',
      label: COPY.nav.leads,
      show: isSales(user) || board,
    },
    { section: 'market', href: '/internal/market', label: COPY.nav.market, show: board },
    { section: 'team', href: '/internal/sales-team', label: COPY.nav.team, show: board },
  ];
  return links.filter((link) => link.show).map(({ show: _show, ...link }) => link);
}

export function toolLinks(user: CurrentUser | null, locale: Locale): readonly BackOfficeLink[] {
  const roles = user?.roles ?? [];
  return internalCopy(locale).nav.flatMap((item) => {
    const section = sectionOf(item.href);
    if (section === null) return [];
    if (!TOOL_ROLES[section].some((role) => roles.includes(role))) return [];
    return [{ section, href: item.href, label: item.label }];
  });
}

/** Seluruh back-office dalam satu urutan — papan dulu, lalu alat. */
export function backOfficeLinks(
  user: CurrentUser | null,
  locale: Locale,
): readonly BackOfficeLink[] {
  return [...boardLinks(user, locale), ...toolLinks(user, locale)];
}

function sectionOf(href: string): ToolSection | null {
  const tail = href.replace('/internal/', '');
  return tail in TOOL_ROLES ? (tail as ToolSection) : null;
}
