'use client';

/**
 * Tab Pasar dashboard admin (P26-07, docs/MARKET_INTELLIGENCE.md §7): agregat tanpa identitas. Ambang
 * k-anonimitas sudah diterapkan server; panel ini hanya menampilkan dan menyebut berapa yang ditahan.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '../locale';
import {
  fetchMarket,
  type AggregateResult,
  type Loaded,
  type MarketDashboard,
} from './dashboard-api';
import { dashboardCopy } from './dashboard-copy';
import styles from './dashboard.module.css';
import { salesCopy } from './sales-copy';

const PERIODS = [30, 90, 365] as const;

export function MarketPanel() {
  const { locale } = useLocale();
  const COPY = dashboardCopy(locale);
  const LABELS = salesCopy(locale);
  const [days, setDays] = useState<number>(90);
  const [data, setData] = useState<Loaded<MarketDashboard> | null>(null);

  const load = useCallback(async () => {
    setData(null);
    setData(await fetchMarket(days));
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const month = (ym: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${ym}-01T00:00:00Z`));
  const building = (key: string) => LABELS.buildingTypes[key] ?? LABELS.cases[key] ?? key;
  const region = (key: string) => (key === 'tidak_diketahui' ? COPY.market.unknownRegion : key);

  return (
    <section>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{COPY.market.title}</h1>
        <p className={styles.subtitle}>{COPY.market.subtitle}</p>
      </div>
      <div className={styles.filters}>
        <select
          className={styles.control}
          aria-label={COPY.market.period}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {PERIODS.map((n) => (
            <option key={n} value={n}>
              {COPY.market.days(n)}
            </option>
          ))}
        </select>
      </div>

      {data === null && <p className={styles.muted}>{COPY.loading}</p>}
      {data !== null && data.kind !== 'ok' && (
        <div className={styles.notice} role="alert">
          <p>{COPY.failed}</p>
          <button type="button" className={styles.secondary} onClick={() => void load()}>
            {COPY.retry}
          </button>
        </div>
      )}
      {data?.kind === 'ok' && data.value.total === 0 && (
        <p className={styles.muted}>{COPY.market.empty}</p>
      )}
      {data?.kind === 'ok' && data.value.total > 0 && (
        <>
          <ol className={styles.funnel} aria-label={COPY.market.title}>
            {(
              ['started', 'reachedSolution', 'routedToTechnical', 'requestedQuotation'] as const
            ).map((key) => (
              <li key={key}>
                <div className={styles.funnelStep}>
                  <span className={styles.funnelCount}>{data.value.funnel[key]}</span>
                  <span className={styles.funnelMeaning}>{COPY.market.funnel[key]}</span>
                </div>
              </li>
            ))}
          </ol>
          <ul className={styles.factList}>
            <li>
              {COPY.market.scope(
                new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
                  style: 'percent',
                  maximumFractionDigits: 0,
                }).format(data.value.scope.ratio),
              )}
            </li>
            <li>{COPY.market.drainage(data.value.drainage)}</li>
          </ul>

          <AggregateTable
            title={COPY.market.regional}
            result={data.value.regional}
            label={(key) => {
              const [name = '', ym = ''] = key.split('|');
              return `${name} · ${month(ym)}`;
            }}
          />
          <AggregateTable
            title={COPY.market.products}
            result={data.value.productInterest}
            label={(key) => {
              const [family = '', size = '', ym = ''] = key.split('|');
              return `${family} ${size} · ${month(ym)}`;
            }}
          />
          <AggregateTable
            title={COPY.market.projects}
            result={data.value.projects}
            label={(key) => {
              const [type = '', scale = '', place = ''] = key.split('|');
              return `${building(type)} · ${COPY.market.scale[scale] ?? scale} · ${region(place)}`;
            }}
          />
          <p className={styles.meta}>
            <a
              className={styles.back}
              href="https://db-ip.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              {COPY.market.attribution}
            </a>
          </p>
        </>
      )}
    </section>
  );
}

function AggregateTable({
  title,
  result,
  label,
}: {
  title: string;
  result: AggregateResult;
  label: (key: string) => string;
}) {
  const { locale } = useLocale();
  const COPY = dashboardCopy(locale);
  return (
    <div className={styles.block}>
      <span className={styles.blockTitle}>{title}</span>
      {result.buckets.length > 0 && (
        <ul className={styles.teamList}>
          {result.buckets.map((bucket) => (
            <li key={bucket.key} className={styles.teamRow}>
              <div>{label(bucket.key)}</div>
              <span className={styles.name}>{bucket.count}</span>
            </li>
          ))}
        </ul>
      )}
      {result.suppressedGroups > 0 && (
        <p className={styles.meta}>
          {COPY.market.suppressed(result.suppressedGroups, result.suppressedEvents)}
        </p>
      )}
    </div>
  );
}
