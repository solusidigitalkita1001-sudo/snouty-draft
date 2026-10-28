'use client';

/**
 * Tim sales (P26-05/P26-08): anggota yang menerima prospek, beban masing-masing, dan penambahan lewat
 * email akun terdaftar. Menambah/mencabut hanya `admin` — API yang menegakkannya; layar ini mengikuti.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getCurrentUser } from '../auth/session';
import { useLocale } from '../locale';
import {
  addSalesMember,
  fetchSalesTeam,
  removeSalesMember,
  type SalesMember,
} from './dashboard-api';
import { dashboardCopy } from './dashboard-copy';
import { EmptyState } from './empty-state';
import styles from './dashboard.module.css';

export function TeamPanel() {
  const { locale } = useLocale();
  const COPY = dashboardCopy(locale);
  const [team, setTeam] = useState<readonly SalesMember[] | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = getCurrentUser()?.roles?.includes('admin') ?? false;

  const load = useCallback(async () => {
    const result = await fetchSalesTeam();
    setTeam(result.kind === 'ok' ? result.value.items : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const errorText = (code: string) => COPY.errors[code] ?? COPY.errors['generic'] ?? '';

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || email.trim() === '') return;
    setBusy(true);
    setError(null);
    const problem = await addSalesMember(email.trim());
    setBusy(false);
    if (problem !== null) {
      setError(errorText(problem));
      return;
    }
    setEmail('');
    await load();
  };

  const remove = async (id: string) => {
    setError(null);
    const problem = await removeSalesMember(id);
    if (problem !== null) {
      setError(errorText(problem));
      return;
    }
    await load();
  };

  return (
    <>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{COPY.team.title}</h1>
        <p className={styles.subtitle}>{COPY.team.subtitle}</p>
      </div>

      {isAdmin ? (
        <form className={styles.addForm} onSubmit={(e) => void add(e)}>
          <input
            className={[styles.control, styles.search].join(' ')}
            type="email"
            required
            placeholder={COPY.team.email}
            aria-label={COPY.team.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? COPY.team.adding : COPY.team.add}
          </button>
        </form>
      ) : (
        <p className={styles.muted}>{COPY.team.adminOnly}</p>
      )}
      {error !== null && (
        <p className={styles.rowError} role="alert">
          {error}
        </p>
      )}

      {team === null && <p className={styles.muted}>{COPY.loading}</p>}
      {team !== null && team.length === 0 && <EmptyState mood="confused" text={COPY.team.empty} />}

      {team !== null && team.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{COPY.team.membersTitle}</h2>
          <p className={styles.muted}>{COPY.team.spread(team.length, totalLeads(team))}</p>
          <ul className={styles.teamList}>
            {team.map((member) => (
              <li key={member.id} className={styles.teamRow}>
                <div>
                  <div className={styles.name}>{member.name}</div>
                  <div className={styles.meta}>{member.email}</div>
                </div>
                {/* Batangnya hiasan: angkanya ada di tautan sebelahnya, jadi tidak ada makna
                    yang hanya dibawa panjang batang. */}
                <span className={styles.loadTrack} aria-hidden="true">
                  <span
                    className={styles.loadFill}
                    style={{ width: `${share(member.openLeads, team)}%` }}
                  />
                </span>
                <a className={styles.back} href={`/internal/prospects?sales=${member.id}`}>
                  {COPY.team.openLeads(member.openLeads)}
                </a>
                {isAdmin && (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => void remove(member.id)}
                  >
                    {COPY.team.remove}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Jumlah prospek yang sedang berjalan di seluruh tim. */
function totalLeads(team: readonly SalesMember[]): number {
  return team.reduce((sum, member) => sum + member.openLeads, 0);
}

/** Panjang batang beban, relatif terhadap anggota yang paling sibuk. */
function share(openLeads: number, team: readonly SalesMember[]): number {
  const busiest = Math.max(...team.map((member) => member.openLeads), 1);
  return Math.round((openLeads / busiest) * 100);
}
