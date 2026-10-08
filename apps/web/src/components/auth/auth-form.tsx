'use client';

/**
 * Formulir masuk dan daftar. **BELUM DIDESAIN (OQ-21)** — lihat `auth-copy.ts`.
 *
 * Satu komponen untuk dua layar karena bedanya hanya satu field dan satu endpoint; dua
 * komponen yang 90% sama akan menyimpang saat desainnya datang.
 *
 * Banner "menunggu desain" dirender **tanpa syarat**, dengan alasan yang sama seperti catatan
 * wajib skema: tidak ada prop yang bisa menyembunyikannya, sehingga layar ini tidak bisa
 * dikira final hanya karena seseorang lupa.
 */

import { useCallback, useState } from 'react';
import { authCopy } from './auth-copy';
import { useLocale } from '../locale';
import { login, register } from './auth-api';
import { afterAuthHref } from './resume-link';
import styles from './auth.module.css';

/** Teks UI mengikuti bahasa yang dipilih (Fase 15). */
function useAuthCopy() {
  return authCopy(useLocale().locale);
}

/** Teks galat per kode — dari copy bahasa aktif, maka fungsi, bukan konstanta modul. */
function errorText(copy: ReturnType<typeof authCopy>, code: string): string | undefined {
  const byCode: Readonly<Record<string, string>> = {
    UNAUTHENTICATED: copy.errors.invalid,
    VALIDATION_FAILED: copy.errors.weakPassword,
    RATE_LIMITED: copy.errors.rateLimited,
    EMAIL_ALREADY_REGISTERED: copy.errors.emailTaken,
  };
  return byCode[code];
}

/**
 * Ikon mata, SVG inline — bukan emoji dan bukan pustaka ikon.
 *
 * Emoji dirender berbeda di tiap sistem dan ukurannya tidak bisa dikendalikan; satu pustaka
 * ikon untuk satu ikon adalah dependensi yang tidak sepadan. `currentColor` membuatnya ikut
 * warna tombolnya, termasuk di mode gelap.
 */
function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4S1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="1.9" />
      {crossed && <path d="M2.5 13.5 13.5 2.5" />}
    </svg>
  );
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const COPY = useAuthCopy();
  const copy = mode === 'login' ? COPY.login : COPY.register;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setError(null);

      const result =
        mode === 'login' ? await login(email, password) : await register(name, email, password);

      if (result.ok) {
        // Percakapan tamu yang berpindah dibuka langsung — itu janji "tidak perlu mengulang
        // cerita" (invarian G-1), dan membiarkan pengguna mencarinya sendiri melanggarnya.
        // Datang dari register-gate (P8-09): aksi yang tadi ditekan ikut diteruskan.
        window.location.href = afterAuthHref(
          window.location.search,
          result.resumedConversationId ?? null,
        );
        return;
      }

      setError(errorText(COPY, result.code ?? '') ?? COPY.errors.generic);
      setBusy(false);
    },
    [busy, email, mode, name, password],
  );

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={submit}>
        <div>
          <div className={styles.brandName}>{COPY.brand.name}</div>
          <div className={styles.brandKicker}>{COPY.brand.kicker}</div>
        </div>

        <div>
          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.subtitle}>{copy.subtitle}</p>
        </div>

        {mode === 'register' && (
          <label className={styles.field}>
            <span className={styles.label}>{COPY.fields.name}</span>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
        )}

        <label className={styles.field}>
          <span className={styles.label}>{COPY.fields.email}</span>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{COPY.fields.password}</span>
          <span className={styles.passwordWrap}>
            <input
              className={[styles.input, styles.passwordInput].join(' ')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={12}
              // Petunjuk lewat `aria-describedby`, BUKAN di dalam label: teks di dalam label
              // ikut menjadi nama aksesibelnya, sehingga pembaca layar akan menyebut
              // "Kata sandi Minimal 12 karakter" setiap kali field itu disinggung.
              {...(mode === 'register' ? { 'aria-describedby': 'password-hint' } : {})}
              required
            />
            {/*
              `type="button"` — tanpa itu ia men-submit formulir, dan pengguna yang hanya
              ingin memeriksa ketikannya justru mengirim kredensial.
              `aria-pressed` menyatakan keadaannya, dan labelnya berubah supaya pembaca layar
              tahu apa yang akan terjadi, bukan hanya ikon mata yang tak terbaca.
            */}
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((shown) => !shown)}
              aria-pressed={showPassword}
              aria-label={showPassword ? COPY.fields.hidePassword : COPY.fields.showPassword}
              title={showPassword ? COPY.fields.hidePassword : COPY.fields.showPassword}
            >
              <EyeIcon crossed={showPassword} />
            </button>
          </span>
        </label>
        {mode === 'register' && (
          <span id="password-hint" className={styles.hint}>
            {COPY.fields.passwordHint}
          </span>
        )}

        {mode === 'register' && <p className={styles.resumeNote}>{COPY.register.resumeNote}</p>}

        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={busy}>
          {copy.submit}
        </button>

        <a
          className={styles.switch}
          href={mode === 'login' ? '/register' : '/login'}
          onClick={(event) => {
            // Pindah daftar ↔ masuk tidak boleh menjatuhkan percakapan yang sedang dilanjutkan.
            event.preventDefault();
            window.location.href = event.currentTarget.pathname + window.location.search;
          }}
        >
          {mode === 'login' ? COPY.login.toRegister : COPY.register.toLogin}
        </a>
      </form>
    </main>
  );
}
