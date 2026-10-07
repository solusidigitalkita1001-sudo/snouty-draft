'use client';

/**
 * Pop-up akun (OQ-53; keputusan pemilik 2026-10-07: pop-up di dalam workspace, gaya tema yang
 * sama, satu tombol Simpan untuk semuanya). Tanpa logika bisnis: kebijakan sandi dan verifikasi
 * sandi lama ada di API; di sini hanya mengumpulkan isian dan memetakan kode galat ke teks.
 *
 * Satu "Simpan": nama disimpan bila berubah; kata sandi diganti bila kolom sandi baru diisi.
 * Dua panggilan API bila keduanya berubah — hasilnya dilaporkan sebagai satu status.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { changePassword, fetchProfile, logout, updateName, type Profile } from '../auth/auth-api';
import { LocaleToggle, useLocale } from '../locale';
import { ThemeToggle } from '../theme-toggle';
import { accountCopy } from './account-copy';
import styles from './account-modal.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Notice = { readonly kind: 'ok' | 'error'; readonly text: string } | null;

export function AccountModal({
  onClose,
  onProfileChange,
}: {
  onClose: () => void;
  /** Nama baru untuk kaki sidebar, tanpa muat ulang. */
  onProfileChange?: (profile: Profile) => void;
}) {
  const COPY = accountCopy(useLocale().locale);
  const [profile, setProfile] = useState<Profile | null | 'loading'>('loading');
  const [name, setName] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchProfile().then((result) => {
      if (cancelled) return;
      if (result.ok && result.profile) {
        setProfile(result.profile);
        setName(result.profile.name);
      } else {
        setProfile(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;
      const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === cardRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

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

  const save = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (busy || profile === null || profile === 'loading') return;
      const nameChanged = name.trim() !== '' && name.trim() !== profile.name;
      const passwordChanged = next !== '';
      if (!nameChanged && !passwordChanged) {
        setNotice({ kind: 'ok', text: COPY.nothingToSave });
        return;
      }
      if (passwordChanged && current === '') {
        setNotice({ kind: 'error', text: COPY.errors.currentPasswordRequired });
        return;
      }
      setBusy(true);
      setNotice(null);
      if (nameChanged) {
        const result = await updateName(name);
        if (!result.ok || !result.profile) {
          setBusy(false);
          setNotice({ kind: 'error', text: errorText(result.code, result.reason) });
          return;
        }
        setProfile(result.profile);
        onProfileChange?.(result.profile);
      }
      if (passwordChanged) {
        const result = await changePassword(current, next);
        if (!result.ok) {
          setBusy(false);
          setNotice({ kind: 'error', text: errorText(result.code, result.reason) });
          return;
        }
        setCurrent('');
        setNext('');
      }
      setBusy(false);
      setNotice({ kind: 'ok', text: COPY.saved });
    },
    [COPY, busy, current, errorText, name, next, onProfileChange, profile],
  );

  const signOut = useCallback(async () => {
    await logout();
    window.location.assign('/consultation');
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="account-title" className={styles.title}>
              {COPY.title}
            </h2>
            <span className={styles.subtitle}>{COPY.subtitle}</span>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={COPY.close}>
            ×
          </button>
        </header>

        {profile === 'loading' && <p className={styles.muted}>{COPY.loading}</p>}

        {profile === null && (
          <div className={styles.body}>
            <p className={styles.muted}>{COPY.signedOut}</p>
            <div className={styles.actions}>
              <a className={styles.primary} href="/login">
                {COPY.signIn}
              </a>
              <a className={styles.secondary} href="/register">
                {COPY.register}
              </a>
            </div>
          </div>
        )}

        {profile !== null && profile !== 'loading' && (
          <form className={styles.body} onSubmit={(e) => void save(e)}>
            <div className={styles.grid}>
              <label className={styles.field}>
                <span className={styles.label}>{COPY.name}</span>
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
                <span className={styles.label}>{COPY.email}</span>
                <span className={styles.readonly}>{profile.email}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>{COPY.tier}</span>
                <span className={styles.readonly}>{COPY.tiers[profile.tier] ?? profile.tier}</span>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>{COPY.passwordHeading}</span>
                <span className={styles.hint}>{COPY.passwordNote}</span>
              </div>
              <div className={styles.grid}>
                <label className={styles.field}>
                  <span className={styles.label}>{COPY.currentPassword}</span>
                  <input
                    className={styles.input}
                    type="password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{COPY.newPassword}</span>
                  <input
                    className={styles.input}
                    type="password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    autoComplete="new-password"
                    minLength={12}
                    aria-describedby="account-password-hint"
                  />
                </label>
                {/* Di luar label: teks di dalam label ikut menjadi nama aksesibel field-nya. */}
                <span id="account-password-hint" className={styles.hint}>
                  {COPY.passwordHint}
                </span>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>{COPY.display}</span>
              </div>
              <div className={styles.toggles}>
                <ThemeToggle className={styles.toggle ?? ''} />
                <LocaleToggle className={styles.toggle ?? ''} />
              </div>
            </div>

            {notice && (
              <p
                className={notice.kind === 'ok' ? styles.ok : styles.error}
                role={notice.kind === 'ok' ? 'status' : 'alert'}
              >
                {notice.text}
              </p>
            )}

            <div className={styles.footer}>
              <button type="button" className={styles.link} onClick={() => void signOut()}>
                {COPY.logout}
              </button>
              <button type="submit" className={styles.primary} disabled={busy}>
                {busy ? COPY.saving : COPY.save}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
