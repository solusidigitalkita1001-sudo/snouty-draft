/**
 * Teks UI dua bahasa (Fase 15, P15-02).
 *
 * Setiap modul `*-copy.ts` mengekspor objek Indonesia (sumber kebenaran redaksi dari desain) dan
 * kembarannya dalam Inggris dengan **bentuk yang sama** — `CopyShape` memaksa kunci yang sama,
 * sehingga teks yang lupa diterjemahkan gagal typecheck, bukan tampil kosong. Komponen memilih
 * lewat `useLocale()`; fungsi di luar komponen menerima objek copy sebagai parameter.
 */
import type { Locale } from '@snouty/shared-types';

/** Bentuk objek copy: string → string, fungsi dipertahankan apa adanya, objek direkursi. */
export type CopyShape<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends (...args: never[]) => unknown
      ? T[K]
      : T[K] extends readonly string[]
        ? readonly string[]
        : CopyShape<T[K]>;
};

export function pickCopy<T>(locale: Locale, id: T, en: CopyShape<T>): CopyShape<T> {
  return locale === 'en' ? en : (id as CopyShape<T>);
}
