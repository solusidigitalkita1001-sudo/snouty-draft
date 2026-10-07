/**
 * Bahasa antarmuka dan jawaban (Fase 15, keputusan pemilik 2026-10-07: ID + EN penuh).
 *
 * Bahasa adalah atribut PERCAKAPAN, ditetapkan saat percakapan dibuat: label parameter yang
 * disalin ke state, pertanyaan klarifikasi, dan prosa yang tersimpan lahir dalam satu bahasa.
 * Mengganti bahasa di tengah percakapan akan mencampur keduanya — pengganti bahasa di UI
 * berlaku untuk percakapan BERIKUTNYA, dan percakapan lama tetap dalam bahasanya.
 */
export const LOCALES = ['id', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'id';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Bahasa dari header `Accept-Language` ("en-US,en;q=0.9,id;q=0.8" → `en`): tag pertama yang
 * kita dukung menang; selain itu baku. Dipakai hanya bila klien tidak menyebut bahasa di body.
 */
export function localeFromAcceptLanguage(header: string | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(',')) {
    const tag = part.trim().split(';')[0]?.toLowerCase().split('-')[0];
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}
