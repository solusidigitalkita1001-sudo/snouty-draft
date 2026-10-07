'use client';

/**
 * Bahasa antarmuka (Fase 15): `id` | `en`, disimpan di localStorage seperti tema, dipasang ke
 * `<html lang>` sebelum cat pertama, dan dikirim saat percakapan dibuat. Percakapan yang sudah
 * ada tetap dalam bahasanya (lihat `packages/shared-types/src/locale.ts`).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@snouty/shared-types';

const STORAGE_KEY = 'snouty-locale';

export const LOCALE_INIT_SCRIPT = `(function(){try{var l=localStorage.getItem('${STORAGE_KEY}');if(l==='en'||l==='id')document.documentElement.lang=l;}catch(e){}})();`;

interface LocaleContextValue {
  readonly locale: Locale;
  readonly setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
});

export function LocaleProvider({
  children,
  initial = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  /** Bahasa awal sebelum localStorage dibaca — untuk tes dan pratinjau. */
  initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) setLocaleState(stored);
    } catch {
      // localStorage bisa terlarang (mode privat) — baku tetap dipakai.
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Pilihan tidak tersimpan; sesi ini tetap memakainya.
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/** Tombol ganti bahasa: menampilkan bahasa TUJUAN ("EN" saat Indonesia aktif), seperti pengalih tema. */
export function LocaleToggle({ className, compact }: { className?: string; compact?: boolean }) {
  const { locale, setLocale } = useLocale();
  const target: Locale = locale === 'id' ? 'en' : 'id';
  const label = locale === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia';
  return (
    <button
      type="button"
      className={className}
      onClick={() => setLocale(target)}
      aria-label={label}
      title={label}
      lang={target}
    >
      {compact ? target.toUpperCase() : target === 'en' ? 'English' : 'Indonesia'}
    </button>
  );
}
