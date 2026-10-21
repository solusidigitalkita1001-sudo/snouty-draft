'use client';

/**
 * Chart dashboard internal (P26-08). Semuanya **satu seri** — pekerjaannya magnitudo, jadi satu warna
 * saja: tidak ada palet kategorikal yang perlu divalidasi, dan warna tidak pernah menjadi satu-satunya
 * pembawa makna (setiap batang memakai label teks dan angkanya sendiri).
 *
 * Digambar SVG inline dengan token warna yang sama seperti layar lain, jadi mode gelap ikut sendiri
 * tanpa palet kedua. Tanpa pustaka chart: bentuknya batang dan garis sederhana, dan satu dependensi
 * baru tidak sepadan.
 */
import { useId, useState, type ReactNode } from 'react';
import styles from './charts.module.css';

export interface Slice {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** Keterangan kedua di bawah label (mis. arti tahap 5A). */
  readonly detail?: string;
}

const EMPTY_BAR = 2;

/**
 * Batang mendatar: label di kiri, batang dan angkanya di kanan. Dipakai untuk peringkat (provinsi,
 * produk, pola proyek) dan untuk corong, karena label teks panjang muat tanpa diputar.
 */
export function BarList({
  slices,
  valueLabel,
  onSelect,
  selected,
  graded = false,
}: {
  slices: readonly Slice[];
  /** Pembaca layar: "7 konsultasi" lebih jelas daripada "7". */
  valueLabel?: (value: number) => string;
  onSelect?: (key: string) => void;
  selected?: string | null;
  /** Deret berurutan (tahap 5A): tiap batang satu langkah gradasi menurut urutannya, bukan besarnya. */
  graded?: boolean;
}) {
  const max = Math.max(...slices.map((s) => s.value), 1);
  return (
    <ul className={styles.chartBars}>
      {slices.map((slice, index) => {
        const width =
          slice.value === 0 ? EMPTY_BAR : Math.max(EMPTY_BAR, (slice.value / max) * 100);
        const on = selected === slice.key;
        const body = (
          <>
            <span className={styles.chartBarLabel}>
              {slice.label}
              {slice.detail !== undefined && <small>{slice.detail}</small>}
            </span>
            <span className={styles.chartBarTrack}>
              <span className={styles.chartBarFill} style={{ width: `${width}%` }} />
            </span>
            <span className={styles.chartBarValue}>{slice.value}</span>
          </>
        );
        const title = valueLabel ? `${slice.label}: ${valueLabel(slice.value)}` : slice.label;
        return (
          <li
            key={slice.key}
            className={[
              styles.chartBar,
              graded ? (styles[`tone${Math.min(5, index + 1)}`] ?? '') : '',
              on ? styles.chartBarOn : '',
            ].join(' ')}
            title={title}
          >
            {onSelect ? (
              <button type="button" aria-pressed={on} onClick={() => onSelect(slice.key)}>
                {body}
              </button>
            ) : (
              <span className={styles.chartRow}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Garis tren bulanan: 2px, penanda bulat ≥ 8px, dan crosshair + tooltip saat ditunjuk. Satu seri, jadi
 * judulnya yang menamai datanya — tanpa legenda.
 */
export function TrendLine({
  points,
  valueLabel,
}: {
  points: readonly { readonly label: string; readonly value: number }[];
  valueLabel: (value: number) => string;
}) {
  const clip = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  const W = 640;
  const H = 180;
  const PAD = { top: 16, right: 16, bottom: 28, left: 36 };
  const max = Math.max(...points.map((p) => p.value), 1);
  const x = (i: number) =>
    PAD.left + (i * (W - PAD.left - PAD.right)) / Math.max(1, points.length - 1);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const ticks = [0, Math.round(max / 2), max].filter((t, i, all) => all.indexOf(t) === i);
  const active = hover === null ? null : points[hover];

  return (
    <div className={styles.chartLineWrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.chartLine}
        role="img"
        aria-label={points.map((p) => `${p.label}: ${valueLabel(p.value)}`).join('; ')}
        onMouseLeave={() => setHover(null)}
      >
        <clipPath id={clip}>
          <rect x={PAD.left} y={0} width={W - PAD.left - PAD.right} height={H} />
        </clipPath>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className={styles.chartGrid}
            />
            <text
              x={PAD.left - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              className={styles.chartTick}
            >
              {tick}
            </text>
          </g>
        ))}
        <path d={path} className={styles.chartPath} clipPath={`url(#${clip})`} />
        {points.map((point, i) => (
          <g key={point.label}>
            {hover === i && (
              <line
                x1={x(i)}
                x2={x(i)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                className={styles.chartCrosshair}
              />
            )}
            <circle
              cx={x(i)}
              cy={y(point.value)}
              r={hover === i ? 6 : 4}
              className={styles.chartDot}
            />
            {/* Sasaran tunjuk lebih besar daripada penandanya. */}
            <rect
              x={x(i) - 16}
              y={PAD.top}
              width={32}
              height={H - PAD.top - PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {(i === 0 || i === points.length - 1) && (
              <text
                x={x(i)}
                y={H - 8}
                textAnchor={i === 0 ? 'start' : 'end'}
                className={styles.chartTick}
              >
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className={styles.chartHoverNote} role="status">
        {active ? `${active.label} · ${valueLabel(active.value)}` : ' '}
      </p>
    </div>
  );
}

export interface RankRow {
  readonly key: string;
  readonly label: string;
  /** Keterangan kedua, mis. bulan atau skala proyek. */
  readonly detail?: string;
  /** Lencana kecil di samping label — ukuran pipa, kelas, atau kode. */
  readonly badge?: string;
  readonly value: number;
  readonly icon?: ReactNode;
}

/**
 * Daftar peringkat: nomor urut, ikon, nama, lencana, batang, lalu angkanya. Dipakai untuk minat
 * produk, permintaan provinsi, dan pola proyek — tiga daftar yang dulu hanya teks dan angka.
 */
export function RankList({
  rows,
  valueLabel,
  total,
}: {
  rows: readonly RankRow[];
  valueLabel: (value: number) => string;
  /** Bila diberikan, tiap baris menyebut porsinya terhadap keseluruhan. */
  total?: number;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const percent = (value: number) =>
    total !== undefined && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <ol className={styles.rankList}>
      {rows.map((row, index) => {
        const share = percent(row.value);
        return (
          <li
            key={row.key}
            className={styles.rankRow}
            title={`${row.label}: ${valueLabel(row.value)}`}
          >
            <span className={styles.rankNo}>{index + 1}</span>
            <span className={styles.rankMain}>
              <span className={styles.rankTitle}>
                {row.icon !== undefined && <span className={styles.rankIcon}>{row.icon}</span>}
                <span className={styles.rankName}>{row.label}</span>
                {row.badge !== undefined && <span className={styles.rankBadge}>{row.badge}</span>}
              </span>
              <span className={styles.rankTrack}>
                <span
                  className={styles.rankFill}
                  style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
                />
              </span>
              {row.detail !== undefined && <span className={styles.rankDetail}>{row.detail}</span>}
            </span>
            <span className={styles.rankValue}>
              <strong>{row.value}</strong>
              {share !== null && <small>{share}%</small>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
