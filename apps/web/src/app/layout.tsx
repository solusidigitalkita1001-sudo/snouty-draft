import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { THEME_INIT_SCRIPT } from '../components/theme-toggle';
import { LOCALE_INIT_SCRIPT, LocaleProvider } from '../components/locale';
import './globals.css';

/**
 * Font di-host sendiri (SPEC §16). `next/font/google` mengunduh berkasnya saat
 * build dan menyajikannya dari domain kita — nol permintaan ke Google saat
 * runtime, sehingga CSP bisa dibuat ketat tanpa pengecualian.
 */
const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SNOUTY — Pralon Pipe Solution Assistant',
  description: 'Asisten solusi perpipaan Pralon.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Tema sebelum cat pertama — string statis milik kita, bukan keluaran model. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Bahasa juga sebelum cat pertama — string statis milik kita. */}
        <script dangerouslySetInnerHTML={{ __html: LOCALE_INIT_SCRIPT }} />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
