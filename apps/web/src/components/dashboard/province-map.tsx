'use client';

/**
 * Peta permintaan (P26-12, pemilik 2026-10-21: "zone by province, klik → zoom ke sebaran titiknya").
 *
 * Zona provinsi diwarnai menurut jumlah konsultasi — satu hue, terang ke gelap, karena pekerjaannya
 * magnitudo. Warna tidak pernah satu-satunya pembawa makna: hover memberi jumlahnya, provinsi dengan
 * data diberi label, dan daftar di bawah peta mengulang angkanya sebagai teks.
 *
 * Geometri dari Natural Earth (domain publik) lewat `scripts/build-province-map.mjs`; tidak ada ubin
 * peta dari pihak luar, jadi tidak ada permintaan ke luar saat dashboard dibuka.
 */
import { useMemo, useState } from 'react';
import { useLocale } from '../locale';
import { dashboardCopy } from './dashboard-copy';
import type { MapDemand } from './dashboard-api';
import styles from './province-map.module.css';
import atlas from './provinces.json';

const W = 900;
const H = 380;
/** Lima langkah terang→gelap dari satu hue; langkah 0 untuk provinsi tanpa data. */
const STEPS = 5;

interface Atlas {
  readonly bounds: readonly number[];
  readonly provinces: readonly {
    readonly name: string;
    readonly center: readonly number[];
    readonly rings: readonly (readonly (readonly number[])[])[];
  }[];
}

const MAP = atlas as Atlas;
const [MIN_LNG = 95, MIN_LAT = -11, MAX_LNG = 141, MAX_LAT = 6] = MAP.bounds;

/** Proyeksi setara-persegi panjang: cukup untuk peta sesempit lintang Indonesia. */
function project(lng: number, lat: number): [number, number] {
  const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * W;
  const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * H;
  return [x, y];
}

const pathOf = (rings: Atlas['provinces'][number]['rings']) =>
  rings
    .map((ring) =>
      ring
        .map(([lng = 0, lat = 0], i) => {
          const [x, y] = project(lng, lat);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' '),
    )
    .join(' Z ') + ' Z';

function boxOf(rings: Atlas['provinces'][number]['rings']) {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings) {
    for (const [lng = 0, lat = 0] of ring) {
      const [x, y] = project(lng, lat);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  // Sedikit ruang di tepi supaya titik di pinggir provinsi tidak menempel bingkai.
  const pad = Math.max(12, (maxX - minX) * 0.12);
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

export function ProvinceMap({ map }: { map: MapDemand }) {
  const { locale } = useLocale();
  const COPY = dashboardCopy(locale);
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<{ name: string; count: number; x: number; y: number } | null>(
    null,
  );

  const counts = useMemo(
    () => new Map(map.provinces.map((p) => [p.name, p.count])),
    [map.provinces],
  );
  const max = Math.max(...map.provinces.map((p) => p.count), 1);
  const shapes = useMemo(() => MAP.provinces.map((p) => ({ ...p, d: pathOf(p.rings) })), []);
  const focused = shapes.find((p) => p.name === focus) ?? null;
  const view = focused ? boxOf(focused.rings) : { x: 0, y: 0, w: W, h: H };
  const points = focus === null ? [] : map.points.filter((point) => point.province === focus);
  const maxPoint = Math.max(...points.map((p) => p.count), 1);
  /** Jari-jari dari AKAR jumlah: luas lingkaran yang sebanding, bukan jari-jari. */
  const radius = (count: number) => (4 + 10 * Math.sqrt(count / maxPoint)) * (view.w / W) ** 0.6;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>
          {focus === null ? COPY.map.title : COPY.map.focus(focus)}
        </span>
        {focus !== null && (
          <button type="button" className={styles.back} onClick={() => setFocus(null)}>
            {COPY.map.zoomOut}
          </button>
        )}
      </div>

      <div className={styles.canvas}>
        <svg
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className={styles.svg}
          role="img"
          aria-label={
            map.provinces.length === 0
              ? COPY.map.empty
              : map.provinces.map((p) => `${p.name}: ${COPY.map.count(p.count)}`).join('; ')
          }
          onMouseLeave={() => setHover(null)}
        >
          {shapes.map((province) => {
            const count = counts.get(province.name) ?? 0;
            const step = count === 0 ? 0 : Math.max(1, Math.ceil((count / max) * STEPS));
            const [cx, cy] = project(province.center[0] ?? 0, province.center[1] ?? 0);
            return (
              <path
                key={province.name}
                d={province.d}
                className={[
                  styles.zone,
                  styles[`step${step}`],
                  focus === province.name ? styles.zoneOn : '',
                  count > 0 ? styles.zoneLive : '',
                ].join(' ')}
                onMouseEnter={() => setHover({ name: province.name, count, x: cx, y: cy })}
                onClick={() => count > 0 && setFocus(province.name)}
              />
            );
          })}

          {focus === null &&
            map.provinces.map((province) => {
              const shape = shapes.find((s) => s.name === province.name);
              if (shape === undefined) return null;
              const [cx, cy] = project(shape.center[0] ?? 0, shape.center[1] ?? 0);
              return (
                <text key={province.name} x={cx} y={cy} className={styles.zoneLabel}>
                  {province.count}
                </text>
              );
            })}

          {points.map((point) => {
            const [cx, cy] = project(point.lng, point.lat);
            return (
              <g key={`${point.city}|${point.lat}|${point.lng}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius(point.count)}
                  className={styles.point}
                  onMouseEnter={() =>
                    setHover({ name: point.city, count: point.count, x: cx, y: cy })
                  }
                />
                <text x={cx} y={cy - radius(point.count) - 4} className={styles.pointLabel}>
                  {point.city}
                </text>
              </g>
            );
          })}

          {hover !== null && (
            <g className={styles.tip} transform={`translate(${hover.x} ${hover.y})`}>
              <rect x={-70} y={-34} width={140} height={26} rx={6} className={styles.tipBox} />
              <text y={-16} className={styles.tipText}>
                {hover.name} · {hover.count}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Angka yang sama sebagai teks: peta bukan satu-satunya jalan membaca data ini. */}
      {map.provinces.length === 0 ? (
        <p className={styles.note}>{COPY.map.empty}</p>
      ) : (
        <ul className={styles.legend}>
          {map.provinces.map((province) => (
            <li key={province.name}>
              <button
                type="button"
                className={focus === province.name ? styles.legendOn : undefined}
                onClick={() => setFocus(focus === province.name ? null : province.name)}
              >
                {province.name} · {COPY.map.count(province.count)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {focus !== null && points.length === 0 && <p className={styles.note}>{COPY.map.noPoints}</p>}
      {(map.withoutRegion > 0 || map.suppressedPoints > 0) && (
        <p className={styles.note}>{COPY.map.hidden(map.withoutRegion, map.suppressedPoints)}</p>
      )}
    </div>
  );
}
