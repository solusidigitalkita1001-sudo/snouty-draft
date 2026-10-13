'use client';

/**
 * Kartu "Coba ubah" di tab Denah (DD-01, P17-08): tombol bergambar per skenario dan tabel
 * Sekarang ↔ skenario. Angkanya dari `GET /recommendations/:id/scenarios` (engine, tanpa
 * menyimpan); kartu tidak tampil bila skenario tidak tersedia untuk solusi ini.
 */

import type { ScenarioComparison, ScenarioId } from '@snouty/shared-types';
import { useEffect, useState } from 'react';
import { apiFetch, authHeaders } from '../auth/session';
import { SceneImage } from '../illustration/illustration';
import { useLocale } from '../locale';
import { SCENARIO_IMAGE, scenarioLabel, scenarioRows } from './scenario-view';
import { solutionCopy } from './solution-copy';
import styles from './solution.module.css';

export function ScenarioCard({ recommendationId }: { recommendationId: string }) {
  const { locale } = useLocale();
  const COPY = solutionCopy(locale);
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [selected, setSelected] = useState<ScenarioId | null>(null);

  useEffect(() => {
    let cancelled = false;
    setComparison(null);
    setSelected(null);
    void apiFetch(`/api/v1/recommendations/${encodeURIComponent(recommendationId)}/scenarios`, {
      credentials: 'include',
      headers: authHeaders(),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as ScenarioComparison | { error: unknown };
        return 'error' in body ? null : body;
      })
      .then((body) => {
        if (!cancelled) setComparison(body);
      })
      .catch(() => {
        // Tanpa skenario kartunya tidak tampil; denah dan skema tetap ada.
      });
    return () => {
      cancelled = true;
    };
  }, [recommendationId]);

  if (comparison === null || comparison.scenarios.length === 0) return null;
  const chosen = comparison.scenarios.find((s) => s.id === selected) ?? null;
  const copy = COPY.scenarios;
  const label = (id: ScenarioId) => scenarioLabel(id, comparison.raisedByM, copy, locale);
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{copy.title}</h3>
      <div className={styles.scenarioButtons} role="group" aria-label={copy.title}>
        {comparison.scenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            className={styles.scenarioButton}
            aria-pressed={selected === scenario.id}
            onClick={() => setSelected((now) => (now === scenario.id ? null : scenario.id))}
          >
            <SceneImage name={SCENARIO_IMAGE[scenario.id]} className={styles.scenarioImage} />
            <span>{label(scenario.id)}</span>
          </button>
        ))}
      </div>
      {chosen && (
        <div className={styles.tableWrap}>
          <table className={styles.boqTable}>
            <thead>
              <tr>
                <th />
                <th>{copy.now}</th>
                <th>{label(chosen.id)}</th>
              </tr>
            </thead>
            <tbody>
              {scenarioRows(comparison.base, chosen.metrics, copy, locale).map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className={styles.mono}>{row.now}</td>
                  <td
                    className={[styles.mono, row.changed ? styles.scenarioChanged : ''].join(' ')}
                  >
                    {row.then}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
