'use client';

/**
 * Halaman akun (OQ-53) — **BELUM DIDESAIN**. Minimal dan jujur: profil (nama bisa diganti,
 * email dibaca), ganti kata sandi, pengalih tema dan bahasa, keluar. Tanpa logika bisnis:
 * semua aturan (kebijakan sandi, verifikasi sandi lama) ada di API.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { changePassword, fetchProfile, logout, updateName, type Profile } from '../auth/auth-api';
import { restoreSession } from '../auth/session';
import { LocaleToggle, useLocale } from '../locale';
import { ThemeToggle } from '../theme-toggle';
import { accountCopy } from './account-copy';
import styles from './account.module.css';

type Notice = { readonly kind: 'ok' | 'error'; readonly text: string } | null;

export function AccountPage() {
  const { locale } = useLocale();
  const COPY = accountCopy(locale);
  const [profile, setProfile] = useState<Profile | null | 'loading'>('loading');
  const [name, setName] = useState('');
  const [nameNotice, setNameNotice] = useState<Notice>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Muat ulang halaman menghapus access token; pulihkan dari cookie refresh dulu.
      await restoreSession();
      const result = await fetchProfile();
      if (cancelled) return;
      if (result.ok && result.profile) {
        setProfile(result.profile);
        setName(result.profile.name);
      } else {
        setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const errorText = useCallback(
    (code: string | undefined, reason: string | undefined): string => {
      if (code === 'VALIDATION_FAILED' && reason === 'current_password')
        return COPY.errors.currentPassword;
      if (code === 'VALIDATION_FAILED') return COPY.errors.weakPassword;
      if (code === 'RATE_LIMITED') return COPY.errors.rateLimited;
      if (code === 'UNAUTHENTICATED') return COPY.errors.unauthenticated;
      return COPY.errors.generic;
    },
    [COPY],
  );

  const saveName = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (busy || name.trim() === '') return;
      setBusy(true);
      setNameNotice(null);
      const result = await updateName(name);
      setBusy(false);
      if (result.ok && result.profile) {
        setProfile(result.profile);
        setNameNotice({ kind: 'ok', text: COPY.profile.saved });
      } else {
        setNameNotice({ kind: 'error', text: errorText(result.code, result.reason) });
      }
    },
    [COPY, busy, errorText, name],
  );

  const savePassword = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setPasswordNotice(null);
      const result = await changePassword(current, next);
      setBusy(false);
      if (result.ok) {
        setCurrent('');
        setNext('');
        setPasswordNotice({ kind: 'ok', text: COPY.password.changed });
      } else {
        setPasswordNotice({ kind: 'error', text: errorText(result.code, result.reason) });
      }
    },
    [COPY, busy, current, errorText, next],
  );

  const signOut = useCallback(async () => {
    await logout();
    window.location.assign('/consultation');
  }, []);

  return (
    <main className={styles.page}>
      {/* Tanpa syarat: layar ini tidak boleh dikira final. */}
      <div className={styles.needsDesign}>{COPY.needsDesign}</div>

      <div className={styles.card}>
        <a className={styles.back} href="/consultation">
          {COPY.back}
        </a>
        <div>
          <h1 className={styles.title}>{COPY.title}</h1>
          <p className={styles.subtitle}>{COPY.subtitle}</p>
        </div>

        {profile === 'loading' && <p className={styles.muted}>{COPY.loading}</p>}

        {profile === null && (
          <div className={styles.section}>
            <p className={styles.muted}>{COPY.signedOut}</p>
            <a className={styles.submit} href="/login">
              {COPY.signIn}
            </a>
          </div>
        )}

        {profile !== null && profile !== 'loading' && (
          <>
            <form className={styles.section} onSubmit={(e) => void saveName(e)}>
              <h2 className={styles.heading}>{COPY.profile.heading}</h2>
              <label className={styles.field}>
                <span className={styles.label}>{COPY.profile.name}</span>
                <input
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={120}
                  required
                />
              </label>
              <div className={styles.field}>
                <span className={styles.label}>{COPY.profile.email}</span>
                <span className={styles.readonly}>{profile.email}</span>
                <span className={styles.hint}>{COPY.profile.emailNote}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>{COPY.profile.tier}</span>
                <span className={styles.readonly}>
                  {COPY.profile.tiers[profile.tier] ?? profile.tier}
                </span>
              </div>
              {nameNotice && (
                <p className={nameNotice.kind === 'ok' ? styles.ok : styles.error} role="status">
                  {nameNotice.text}
                </p>
              )}
              <button type="submit" className={styles.submit} disabled={busy}>
                {COPY.profile.save}
              </button>
            </form>

            <form className={styles.section} onSubmit={(e) => void savePassword(e)}>
              <h2 className={styles.heading}>{COPY.password.heading}</h2>
              <label className={styles.field}>
                <span className={styles.label}>{COPY.password.current}</span>
                <input
                  className={styles.input}
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>{COPY.password.next}</span>
                <input
                  className={styles.input}
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  aria-describedby="new-password-hint"
                  required
                />
              </label>
              <span id="new-password-hint" className={styles.hint}>
                {COPY.password.hint}
              </span>
              {passwordNotice && (
                <p
                  className={passwordNotice.kind === 'ok' ? styles.ok : styles.error}
                  role={passwordNotice.kind === 'ok' ? 'status' : 'alert'}
                >
                  {passwordNotice.text}
                </p>
              )}
              <button type="submit" className={styles.submit} disabled={busy}>
                {COPY.password.submit}
              </button>
            </form>

            <section className={styles.section}>
              <h2 className={styles.heading}>{COPY.preferences.heading}</h2>
              <div className={styles.toggles}>
                <ThemeToggle className={styles.toggle ?? ''} />
                <LocaleToggle className={styles.toggle ?? ''} />
              </div>
              <span className={styles.hint}>{COPY.preferences.note}</span>
            </section>

            <section className={styles.section}>
              <h2 className={styles.heading}>{COPY.session.heading}</h2>
              <button type="button" className={styles.secondary} onClick={() => void signOut()}>
                {COPY.session.logout}
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
