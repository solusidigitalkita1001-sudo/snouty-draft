'use client';

/**
 * Renderer skema ALIRAN (kasus teknis: gedung, kolam, transfer, sumur, cluster, irigasi, drainase,
 * air hujan, gorong-gorong) — SVG, rel vertikal desain layar 09: kotak sumber → jalur merah
 * berlabel ukuran → simpul pipa yang menonjol → kotak zona → titik ujung.
 *
 * Seperti `SchematicView`, renderer ini **tidak menambahkan informasi**: setiap judul, ukuran, dan
 * angka berasal dari `FlowSchematic`, yang dibentuk dari hasil hitungan kasusnya. Invarian S-1
 * (dua catatan wajib) dirender tanpa syarat.
 */

import type { FlowLinkRole, FlowNode, FlowSchematic } from '@snouty/shared-types';
import { mandatoryNotes, schematicCopy } from './schematic-copy';
import { useLocale } from '../locale';
import styles from './schematic.module.css';

const NODE_WIDTH = 260;
const NODE_HEIGHT = 54;
const LINK_HEIGHT = 56;
const LEAF_WIDTH = 96;
const LEAF_HEIGHT = 40;
const LEAF_GAP = 14;
const PADDING = 24;
const MIN_WIDTH = 500;

export function FlowSchematicView({ schematic }: { schematic: FlowSchematic }) {
  const locale = useLocale().locale;
  const COPY = schematicCopy(locale);
  const NOTES = mandatoryNotes(locale);
  const leaves = schematic.leaves;
  const leavesWidth = leaves ? leaves.items.length * (LEAF_WIDTH + LEAF_GAP) - LEAF_GAP : 0;
  const width = Math.max(MIN_WIDTH, NODE_WIDTH + PADDING * 2 + 180, leavesWidth + PADDING * 2);
  const left = PADDING;
  const centerX = left + NODE_WIDTH / 2;
  const nodeTop = (index: number) => PADDING + index * (NODE_HEIGHT + LINK_HEIGHT);
  const lastBottom = nodeTop(schematic.nodes.length - 1) + NODE_HEIGHT;
  const leavesTop = lastBottom + 58;
  const height = (leaves ? leavesTop + LEAF_HEIGHT : lastBottom) + PADDING;

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
          aria-label={COPY.flowAriaIntro}
        >
          <defs>
            <pattern id="snouty-flow-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M24 0H0v24" fill="none" className={styles.gridLine} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={width} height={height} className={styles.canvasBg} />
          <rect width={width} height={height} fill="url(#snouty-flow-grid)" />

          {schematic.links.map((link, index) => {
            const from = nodeTop(index) + NODE_HEIGHT;
            const to = nodeTop(index + 1);
            return (
              <g key={`link-${index}`}>
                <line
                  x1={centerX}
                  y1={from}
                  x2={centerX}
                  y2={to}
                  className={pipeClass(link.role)}
                  strokeWidth={pipeWidth(link.role)}
                />
                {link.label !== '' && (
                  <text x={centerX + 12} y={(from + to) / 2 + 4} className={styles.flowLinkLabel}>
                    {link.label}
                  </text>
                )}
              </g>
            );
          })}

          {schematic.nodes.map((node, index) => (
            <FlowNodeBox key={node.id} node={node} x={left} y={nodeTop(index)} />
          ))}

          {leaves && (
            <g>
              <text x={left} y={lastBottom + 24} className={styles.flowLeavesTitle}>
                {leaves.title}
              </text>
              <line
                x1={centerX}
                y1={lastBottom}
                x2={centerX}
                y2={leavesTop - 16}
                className={styles.pipeFixture}
                strokeWidth="2"
              />
              <line
                x1={left + LEAF_WIDTH / 2}
                y1={leavesTop - 16}
                x2={Math.max(centerX, left + leavesWidth - LEAF_WIDTH / 2)}
                y2={leavesTop - 16}
                className={styles.pipeFixture}
                strokeWidth="2"
              />
              {leaves.items.map((item, position) => {
                const x = left + position * (LEAF_WIDTH + LEAF_GAP);
                return (
                  <g key={`leaf-${position}`}>
                    <line
                      x1={x + LEAF_WIDTH / 2}
                      y1={leavesTop - 16}
                      x2={x + LEAF_WIDTH / 2}
                      y2={leavesTop}
                      className={styles.pipeFixture}
                      strokeWidth="2"
                    />
                    <rect
                      x={x}
                      y={leavesTop}
                      width={LEAF_WIDTH}
                      height={LEAF_HEIGHT}
                      rx="4"
                      className={styles.fixtureBox}
                    />
                    <text x={x + 8} y={leavesTop + 17} className={styles.fixtureLabel}>
                      {item.label}
                    </text>
                    {item.detail && (
                      <text x={x + 8} y={leavesTop + 31} className={styles.fixtureSize}>
                        {item.detail}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>

      <div className={styles.legend}>
        {COPY.flowLegend.map((item) => (
          <span key={item.role} className={styles.legendItem}>
            <span
              className={[
                styles.legendSwatch,
                swatchClass(item.role as 'main' | 'branch' | 'fixture_connection'),
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

      <details className={styles.textAlternative}>
        <summary>{COPY.textAlternative}</summary>
        <ol>
          {schematic.nodes.map((node, index) => {
            const link = schematic.links[index];
            return (
              <li key={node.id}>
                {node.title}
                {node.detail ? ` (${node.detail})` : ''}
                {link && link.label !== '' ? ` → ${link.label}` : ''}
              </li>
            );
          })}
          {leaves && (
            <li>
              {leaves.title}: {leaves.items.map((item) => item.label).join(', ')}
            </li>
          )}
        </ol>
      </details>
    </figure>
  );
}

function FlowNodeBox({ node, x, y }: { node: FlowNode; x: number; y: number }) {
  const boxClass = node.highlighted
    ? styles.flowNodeHighlight
    : node.type === 'source'
      ? styles.flowNodeSource
      : styles.flowNode;
  return (
    <g>
      <rect x={x} y={y} width={NODE_WIDTH} height={NODE_HEIGHT} rx="5" className={boxClass} />
      <text
        x={x + 14}
        y={y + (node.detail ? 23 : 32)}
        className={node.highlighted ? styles.flowTitleHighlight : styles.flowTitle}
      >
        {node.title}
      </text>
      {node.detail && (
        <text x={x + 14} y={y + 40} className={styles.flowDetail}>
          {node.detail}
        </text>
      )}
    </g>
  );
}

/** Panel DAFTAR JALUR + blok judul 2×2 untuk skema aliran. */
export function FlowSidePanel({ schematic }: { schematic: FlowSchematic }) {
  const COPY = schematicCopy(useLocale().locale);
  const routes = schematic.links.filter((link) => link.label !== '');
  return (
    <aside className={styles.panel}>
      <div className={styles.panelKicker}>{COPY.routeListTitle}</div>
      <div className={styles.routeList}>
        {routes.map((link, index) => (
          <div key={`route-${index}`} className={styles.routeRow}>
            <span className={[styles.routeBar, swatchClass(legendRole(link.role))].join(' ')} />
            <span className={styles.routeName}>{COPY.flowRoles[link.role]}</span>
            <span className={styles.routeSize}>{link.label}</span>
          </div>
        ))}
      </div>
      <div className={styles.titleBlock}>
        <TitleCell label={COPY.titleBlockLabels.drawing} value={schematic.titleBlock.drawing} />
        <TitleCell label={COPY.titleBlockLabels.scale} value={schematic.titleBlock.scale} />
        <TitleCell label={COPY.titleBlockLabels.basis} value={schematic.titleBlock.basis} />
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

function legendRole(role: FlowLinkRole): 'main' | 'branch' | 'fixture_connection' {
  if (role === 'branch') return 'branch';
  if (role === 'fixture_connection') return 'fixture_connection';
  return 'main';
}

function pipeClass(role: FlowLinkRole): string {
  const legend = legendRole(role);
  if (legend === 'branch') return styles.pipeBranch!;
  if (legend === 'fixture_connection') return styles.pipeFixture!;
  return styles.pipeMain!;
}

/** Lebar garis membawa makna, bukan hanya warna (§8): 4 / 3 / 2. */
function pipeWidth(role: FlowLinkRole): number {
  const legend = legendRole(role);
  return legend === 'main' ? 4 : legend === 'branch' ? 3 : 2;
}

function swatchClass(role: 'main' | 'branch' | 'fixture_connection'): string {
  if (role === 'main') return styles.swatchMain!;
  if (role === 'branch') return styles.swatchBranch!;
  return styles.swatchFixture!;
}
