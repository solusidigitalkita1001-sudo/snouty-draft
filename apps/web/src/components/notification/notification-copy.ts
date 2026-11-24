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

/** Nama orang yang dirujuk kejadian itu; `null` bila server tidak mengirimkannya. */
function subjectName(item: NotificationItem): string | null {
  const name = (item.subjectName ?? '').trim();
  return name === '' ? null : name;
}

/**
 * Layar prospek sales memilih prospeknya dari `?u=` (sales-dashboard.tsx). Pemberitahuan dulu
 * menautkan `?prospect=`, yang diabaikan diam-diam — sehingga "buka" membuka prospek teratas,
 * bukan yang diberitahukan (P39-02).
 */
function leadHref(item: NotificationItem): string {
  return item.subjectId ? `/internal/leads?u=${item.subjectId}` : '/internal/leads';
}

const LINES: Readonly<Record<NotificationKind, Line>> = {
  lead_assigned: (item, locale) => {
    const who = subjectName(item);
    return {
      text:
        who === null
          ? locale === 'en'
            ? 'A prospect was assigned to you.'
            : 'Ada prospek yang ditugaskan kepada Anda.'
          : locale === 'en'
            ? `${who} was assigned to you.`
            : `${who} ditugaskan kepada Anda.`,
      href: leadHref(item),
    };
  },
  contact_requested: (item, locale) => {
    const where = SOURCE[locale][String(item.data['source'] ?? '')] ?? '';
    const who = subjectName(item);
    const tail = where ? ` ${where}` : '';
    return {
      text:
        who === null
          ? locale === 'en'
            ? `Someone asked to be contacted by the Pralon team${tail}.`
            : `Ada yang minta dihubungi tim Pralon${tail}.`
          : locale === 'en'
            ? `${who} asked to be contacted by the Pralon team${tail}.`
            : `${who} minta dihubungi tim Pralon${tail}.`,
      href: '/internal/prospects',
    };
  },
  follow_up_due: (item, locale) => {
    const name = subjectName(item) ?? String(item.data['name'] ?? '').trim();
    const who = name === '' ? (locale === 'en' ? 'a prospect' : 'prospek') : name;
    return {
      text:
        locale === 'en' ? `Time to check back in with ${who}.` : `Waktunya menengok ${who} lagi.`,
      href: leadHref(item),
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
