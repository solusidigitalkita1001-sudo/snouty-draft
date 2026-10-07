'use client';

/**
 * Renderer skema — **SVG**, bukan library diagram. docs/SCHEMATIC_ENGINE.md §4.
 *
 * Alasannya: gambar di prototipe adalah gambar teknik dengan tata letak tetap — kolom
 * label lantai, kolom riser, area cabang, garis lantai, blok judul. React Flow dirancang
 * untuk graf yang bisa digeser pengguna, dan itu bukan yang dibutuhkan di sini.
 *
 * Renderer **membaca topologi dan tidak menambahkan informasi apa pun**: setiap angka,
 * ukuran, dan label berasal dari `Schematic`. Itu yang menjaga gambar tidak pernah
 * bertentangan dengan tabel sistem dan BOM.
 *
 * Invarian S-1: kedua catatan wajib dirender tanpa syarat — tidak ada prop yang bisa
 * menyembunyikannya. Lihat `schematic-view.spec.tsx`.
 */

import type { Schematic, SchematicNode } from '@snouty/shared-types';
import { mandatoryNotes, schematicCopy } from './schematic-copy';
import { useLocale } from '../locale';
import styles from './schematic.module.css';

/** Teks UI mengikuti bahasa yang dipilih (Fase 15). */
function useSchematicCopy() {
  return schematicCopy(useLocale().locale);
}

/** Metrik tata letak dari prototipe (§4). */
const LABEL_COLUMN = 84;
const RISER_COLUMN = 76;
const FLOOR_HEIGHT = 132;
const FIXTURE_WIDTH = 96;
const FIXTURE_HEIGHT = 46;
const FIXTURE_GAP = 14;
const PADDING = 18;
const GROUND_BAND = 34;
const MIN_WIDTH = 500;

export function SchematicView({ schematic }: { schematic: Schematic }) {
  const COPY = useSchematicCopy();
  const NOTES = mandatoryNotes(useLocale().locale);
  const floors = schematic.floors;
  const maxFixturesPerFloor = Math.max(
    1,
    ...floors.map(
      (floor) =>
        schematic.nodes.filter((n) => n.type === 'fixture' && n.floorLevel === floor.level).length,
    ),
  );

  const riserX = LABEL_COLUMN + RISER_COLUMN / 2;
  const branchStartX = LABEL_COLUMN + RISER_COLUMN;
  const width = Math.max(
    MIN_WIDTH,
    branchStartX + maxFixturesPerFloor * (FIXTURE_WIDTH + FIXTURE_GAP) + PADDING * 2,
  );
  const height = PADDING + floors.length * FLOOR_HEIGHT + GROUND_BAND;

  const floorTop = (index: number): number => PADDING + index * FLOOR_HEIGHT;

  return (
    <figure className={styles.wrapper}>
      {/* Invarian S-1 — dirender tanpa syarat. */}
      <div className={styles.banner}>{NOTES.banner}</div>

      <div className={styles.canvasScroll}>
        <svg
          className={styles.canvas}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={COPY.ariaIntro}
        >
          <defs>
            <pattern id="snouty-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M24 0H0v24" fill="none" className={styles.gridLine} strokeWidth="1" />
            </pattern>
            <pattern
              id="snouty-ground"
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(135)"
            >
              <line x1="0" y1="0" x2="0" y2="8" className={styles.groundHatch} strokeWidth="1" />
            </pattern>
          </defs>

          <rect width={width} height={height} className={styles.canvasBg} />
          <rect width={width} height={height} fill="url(#snouty-grid)" />

          {floors.map((floor, index) => {
            const top = floorTop(index);
            const baseline = top + FLOOR_HEIGHT;
            const fixtures = schematic.nodes.filter(
              (node) => node.type === 'fixture' && node.floorLevel === floor.level,
            );

            return (
              <g key={floor.level}>
                {/* Garis lantai */}
                <line
                  x1={0}
                  y1={baseline}
                  x2={width}
                  y2={baseline}
                  className={styles.floorLine}
                  strokeWidth="3"
                />

                {/* Kolom label lantai */}
                <text x={PADDING} y={top + 24} className={styles.floorLabel}>
                  {floor.shortLabel}
                </text>
                <text x={PADDING} y={top + 40} className={styles.floorElevation}>
                  {floor.elevationLabel}
                </text>

                {/* Riser */}
                <line
                  x1={riserX}
                  y1={top}
                  x2={riserX}
                  y2={baseline}
                  className={styles.pipeMain}
                  strokeWidth="4"
                />

                {/* Cabang + titik reducer */}
                <line
                  x1={riserX}
                  y1={top + 58}
                  x2={branchStartX + fixtures.length * (FIXTURE_WIDTH + FIXTURE_GAP) - FIXTURE_GAP}
                  y2={top + 58}
                  className={styles.pipeBranch}
                  strokeWidth="3"
                />
                <circle
                  cx={riserX}
                  cy={top + 58}
                  r="7"
                  className={styles.junction}
                  strokeWidth="3"
                />

                {fixtures.map((node, position) => {
                  const x = branchStartX + position * (FIXTURE_WIDTH + FIXTURE_GAP);
                  const boxTop = top + 58 + 22;
                  return (
                    <g key={node.id}>
                      <line
                        x1={x + FIXTURE_WIDTH / 2}
                        y1={top + 58}
                        x2={x + FIXTURE_WIDTH / 2}
                        y2={boxTop}
                        className={styles.pipeFixture}
                        strokeWidth="2"
                      />
                      <rect
                        x={x}
                        y={boxTop}
                        width={FIXTURE_WIDTH}
                        height={FIXTURE_HEIGHT}
                        rx="4"
                        className={styles.fixtureBox}
                      />
                      <text x={x + 8} y={boxTop + 17} className={styles.fixtureCode}>
                        {node.code}
                      </text>
                      <text x={x + 8} y={boxTop + 31} className={styles.fixtureLabel}>
                        {node.label}
                      </text>
                      <text x={x + 8} y={boxTop + 42} className={styles.fixtureSize}>
                        {node.size}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Muka tanah */}
          <rect
            x={0}
            y={height - GROUND_BAND}
            width={width}
            height={GROUND_BAND}
            fill="url(#snouty-ground)"
          />
          <text x={PADDING} y={height - GROUND_BAND + 20} className={styles.groundLabel}>
            {COPY.groundLabel}
          </text>
        </svg>
      </div>

      <div className={styles.legend}>
        {COPY.legend.map((item) => (
          <span key={item.role} className={styles.legendItem}>
            <span
              className={[
                styles.legendSwatch,
                legendClass(item.role as Parameters<typeof legendClass>[0]),
              ].join(' ')}
            />
            {item.label}
          </span>
        ))}
      </div>

      {/* Invarian S-1 — catatan kedua, juga tanpa syarat. */}
      <figcaption className={styles.note}>
        <strong className={styles.noteTitle}>{NOTES.noteTitle}</strong> {NOTES.noteBody}
      </figcaption>

      <SchematicTextAlternative schematic={schematic} />
    </figure>
  );
}

/** Panel DAFTAR JALUR + blok judul 2×2 (§4). */
export function SchematicSidePanel({ schematic }: { schematic: Schematic }) {
  const COPY = useSchematicCopy();
  return (
    <aside className={styles.panel}>
      <div className={styles.panelKicker}>{COPY.routeListTitle}</div>
      <div className={styles.routeList}>
        {schematic.segments.map((segment, index) => (
          <div key={`${segment.from}-${segment.to}-${index}`} className={styles.routeRow}>
            <span className={[styles.routeBar, legendClass(roleKey(segment.role))].join(' ')} />
            <span className={styles.routeName}>{ROLE_LABEL[segment.role]}</span>
            <span className={styles.routeSize}>{segment.size}</span>
          </div>
        ))}
      </div>

      <div className={styles.titleBlock}>
        <TitleCell label={COPY.titleBlockLabels.drawing} value={schematic.titleBlock.drawing} />
        <TitleCell label={COPY.titleBlockLabels.scale} value={schematic.titleBlock.scale} />
        <TitleCell
          label={COPY.titleBlockLabels.floorHeight}
          value={schematic.titleBlock.floorHeight}
        />
        <TitleCell label={COPY.titleBlockLabels.source} value={schematic.titleBlock.source} />
      </div>
    </aside>
  );
}

function TitleCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.titleCell}>
      <span className={styles.titleCellLabel}>{label}</span>
      <span className={styles.titleCellValue}>{value}</span>
    </div>
  );
}

/**
 * Alternatif teks (§8). Bukan `alt` satu kalimat: skema memuat informasi yang nyata,
 * jadi pembaca layar mendapat daftar terstruktur per lantai — bukan pemberitahuan bahwa
 * ada gambar yang tidak bisa mereka lihat.
 */
function SchematicTextAlternative({ schematic }: { schematic: Schematic }) {
  return (
    <details className={styles.textAlternative}>
      <summary>Uraian skema dalam teks</summary>
      <ol>
        {schematic.floors.map((floor) => {
          const fixtures = schematic.nodes.filter(
            (node) => node.type === 'fixture' && node.floorLevel === floor.level,
          );
          return (
            <li key={floor.level}>
              {floor.label} ({floor.elevationLabel}):{' '}
              {fixtures.length === 0
                ? 'tanpa titik air'
                : fixtures
                    .map((node) => `${node.code ?? ''} ${node.label ?? ''}`.trim())
                    .join(', ')}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

const ROLE_LABEL: Readonly<Record<string, string>> = {
  main: 'Jalur utama',
  riser: 'Riser',
  branch: 'Cabang per lantai',
  fixture_connection: 'Sambungan fixture',
};

function roleKey(role: string): 'main' | 'branch' | 'fixture_connection' | 'fitting' {
  if (role === 'main' || role === 'riser') return 'main';
  if (role === 'branch') return 'branch';
  if (role === 'fixture_connection') return 'fixture_connection';
  return 'fitting';
}

function legendClass(role: 'main' | 'branch' | 'fixture_connection' | 'fitting'): string {
  if (role === 'main') return styles.swatchMain!;
  if (role === 'branch') return styles.swatchBranch!;
  if (role === 'fixture_connection') return styles.swatchFixture!;
  return styles.swatchFitting!;
}

/** Node fixture, diekspor untuk dipakai pratinjau layar 06. */
export type { SchematicNode };
