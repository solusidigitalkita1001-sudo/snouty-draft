/**
 * Kalimat pemberitahuan (P27-07) — dirakit di sini, bukan disimpan di database.
 *
 * Teksnya ditulis seperti catatan dari rekan kerja: apa yang terjadi, dan apa yang bisa dibuka.
 * Tanpa label internal, tanpa nama tabel, tanpa "sistem telah" (CLAUDE.md, teks pengguna).
 */
import type { Locale } from '@snouty/shared-types';
import type { NotificationItem, NotificationKind } from './notification-api';

export interface NotificationLine {
  readonly text: string;
  /** Layar yang relevan; `null` bila tidak ada yang bisa dibuka. */
  readonly href: string | null;
}

interface Shell {
  readonly title: string;
  readonly empty: string;
  readonly markAll: string;
  readonly open: string;
  readonly unread: (n: number) => string;
  readonly bell: string;
  readonly justNow: string;
  readonly minutes: (n: number) => string;
  readonly hours: (n: number) => string;
  readonly days: (n: number) => string;
}

const SHELL: Readonly<Record<'id' | 'en', Shell>> = {
  id: {
    title: 'Pemberitahuan',
    empty: 'Belum ada yang perlu dilihat.',
    markAll: 'Tandai sudah dibaca',
    open: 'Buka',
    unread: (n) => `${n} belum dibaca`,
    bell: 'Pemberitahuan',
    justNow: 'baru saja',
    minutes: (n) => `${n} menit lalu`,
    hours: (n) => `${n} jam lalu`,
    days: (n) => `${n} hari lalu`,
  },
  en: {
    title: 'Notifications',
    empty: 'Nothing to look at yet.',
    markAll: 'Mark as read',
    open: 'Open',
    unread: (n) => `${n} unread`,
    bell: 'Notifications',
    justNow: 'just now',
    minutes: (n) => `${n} min ago`,
    hours: (n) => `${n} h ago`,
    days: (n) => `${n} d ago`,
  },
};

const SOURCE: Readonly<Record<'id' | 'en', Readonly<Record<string, string>>>> = {
  id: { solution: 'dari layar solusinya', price: 'saat menanyakan harga' },
  en: { solution: 'from their solution screen', price: 'while asking about price' },
};

type Line = (item: NotificationItem, locale: 'id' | 'en') => NotificationLine;

const LINES: Readonly<Record<NotificationKind, Line>> = {
  lead_assigned: (item, locale) => ({
    text:
      locale === 'en'
        ? 'A prospect was assigned to you.'
        : 'Ada prospek yang ditugaskan kepada Anda.',
    href: item.subjectId ? `/internal/leads?prospect=${item.subjectId}` : '/internal/leads',
  }),
  contact_requested: (item, locale) => {
    const where = SOURCE[locale][String(item.data['source'] ?? '')] ?? '';
    return {
      text:
        locale === 'en'
          ? `Someone asked to be contacted by the Pralon team${where ? ` ${where}` : ''}.`
          : `Ada yang minta dihubungi tim Pralon${where ? ` ${where}` : ''}.`,
      href: '/internal/prospects',
    };
  },
  follow_up_due: (item, locale) => {
    const name = String(item.data['name'] ?? '').trim();
    const who = name === '' ? (locale === 'en' ? 'a prospect' : 'prospek') : name;
    return {
      text:
        locale === 'en'
          ? `Time to check back in with ${who}.`
          : `Waktunya menengok ${who} lagi.`,
      href: item.subjectId ? `/internal/leads?prospect=${item.subjectId}` : '/internal/leads',
    };
  },
  report_ready: (item, locale) => {
    const number = String(item.data['reportNumber'] ?? '');
    const conversationId = item.data['conversationId'];
    return {
      text:
        locale === 'en'
          ? `Your report ${number} is ready to download.`
          : `Laporan ${number} sudah siap diunduh.`,
      href: typeof conversationId === 'string' ? `/consultation?c=${conversationId}` : null,
    };
  },
};

export function notificationShell(locale: Locale): Shell {
  return SHELL[locale === 'en' ? 'en' : 'id'];
}

export function notificationLine(item: NotificationItem, locale: Locale): NotificationLine {
  return LINES[item.kind](item, locale === 'en' ? 'en' : 'id');
}

/** Umur pemberitahuan dalam bahasa biasa — "3 jam lalu", bukan stempel waktu ISO. */
export function notificationAge(iso: string, locale: Locale, now: Date = new Date()): string {
  const shell = notificationShell(locale);
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return shell.justNow;
  if (minutes < 60) return shell.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return shell.hours(hours);
  return shell.days(Math.floor(hours / 24));
}
