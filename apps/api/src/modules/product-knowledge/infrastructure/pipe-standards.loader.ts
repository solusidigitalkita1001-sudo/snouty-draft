/**
 * Membaca tabel standar pipa dari `data/standards/<tanggal>-*\/standards.json` (handbook Pralon,
 * lihat SOURCE.md di foldernya) menjadi `StandardRow`. Folder terbaru menang. Berkas tidak ada →
 * tanpa baris (jawabannya mengaku tidak punya data, bukan galat).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { PipeSize } from '@snouty/shared-types';
import { findDataDir } from '../../understanding/infrastructure/catalog-files.js';
import type { StandardRow } from '../domain/pipe-standards.js';

const Doc = z.object({ no: z.string(), rev: z.string(), date: z.string() });
const Cell = z.union([z.string(), z.number(), z.null()]);
const FileSchema = z.object({
  STD001: z.object({
    doc: Doc,
    classes: z.array(z.object({ id: z.string(), label: z.string() })),
    data: z.record(z.string(), z.array(z.array(Cell))),
  }),
  STD002: z.object({ doc: Doc, rows: z.array(z.array(Cell)) }),
  STD003: z.object({ doc: Doc, rows: z.array(z.array(Cell)) }),
  STD014: z.object({
    doc: Doc,
    rows: z.array(
      z.object({
        od: z.number(),
        vals: z.record(z.string(), z.tuple([z.string(), z.number()]).nullable()),
      }),
    ),
  }),
  SDR_CLASSES: z.array(z.object({ id: z.string(), label: z.string(), pn: z.string() })),
});

/** "6,6 + 0,8" → [6.6, 0.8]. */
function wall(text: string): [number, number] {
  const match = /^\s*([\d,]+)\s*\+\s*([\d,]+)\s*$/.exec(text);
  if (!match) throw new Error(`Tebal dinding tidak terbaca: "${text}"`);
  return [Number(match[1]!.replace(',', '.')), Number(match[2]!.replace(',', '.'))];
}

/** "22,0 ± 0,2" → 22. */
const outer = (text: string): number => Number(text.split('±')[0]!.trim().replace(',', '.'));
const docOf = (d: z.infer<typeof Doc>) => `${d.no} Rev. ${d.rev}`;
const mm = (od: number) => `${od} mm`;
/** `1 1/4"` → label kanonik `1¼"`, sama dengan katalog dan parser ukuran. */
const inch = (nominal: string) => PipeSize.parse(nominal)?.label ?? nominal;

export function standardRowsFrom(raw: unknown): readonly StandardRow[] {
  const f = FileSchema.parse(raw);
  const rows: StandardRow[] = [];

  for (const c of f.STD001.classes) {
    for (const r of f.STD001.data[c.id] ?? []) {
      if (typeof r[1] !== 'string') continue;
      const [w, t] = wall(r[1]);
      rows.push({
        series: 'sni_s',
        classLabel: c.label,
        size: mm(r[0] as number),
        outerMm: r[0] as number,
        wallMm: w,
        wallToleranceMm: t,
        kgPerM: (r[2] as number | null) ?? null,
        document: docOf(f.STD001.doc),
      });
    }
  }

  // STD-002: [od, tebal A, kg/m A, …, tebal B (6), kg/m B (7), …].
  for (const r of f.STD002.rows) {
    for (const [label, wi, ki] of [
      ['Kelas A', 1, 2],
      ['Kelas B', 6, 7],
    ] as const) {
      if (typeof r[wi] !== 'string') continue;
      const [w, t] = wall(r[wi]);
      rows.push({
        series: 'sni_ab',
        classLabel: label,
        size: mm(r[0] as number),
        outerMm: r[0] as number,
        wallMm: w,
        wallToleranceMm: t,
        kgPerM: (r[ki] as number | null) ?? null,
        document: docOf(f.STD002.doc),
      });
    }
  }

  // STD-003: [nominal, OD VP, tebal VP, kg/m VP, berat 4 m VP, OD VU, tebal VU, kg/m VU, berat 4 m VU].
  for (const r of f.STD003.rows) {
    for (const [series, label, oi, wi, ki] of [
      ['jis_vp', 'VP', 1, 2, 3],
      ['jis_vu', 'VU', 5, 6, 7],
    ] as const) {
      if (typeof r[oi] !== 'string' || typeof r[wi] !== 'string') continue;
      const [w, t] = wall(r[wi]);
      rows.push({
        series,
        classLabel: label,
        size: inch(r[0] as string),
        outerMm: outer(r[oi]),
        wallMm: w,
        wallToleranceMm: t,
        kgPerM: (r[ki] as number | null) ?? null,
        document: docOf(f.STD003.doc),
      });
    }
  }

  for (const r of f.STD014.rows) {
    for (const c of f.SDR_CLASSES) {
      const cell = r.vals[c.id];
      if (!cell) continue;
      const [w, t] = wall(cell[0]);
      rows.push({
        series: 'pe100',
        classLabel: c.label,
        pressure: c.pn,
        size: mm(r.od),
        outerMm: r.od,
        wallMm: w,
        wallToleranceMm: t,
        kgPerM: cell[1],
        document: docOf(f.STD014.doc),
      });
    }
  }
  return rows;
}

let cached: readonly StandardRow[] | null = null;

export function pipeStandardRows(): readonly StandardRow[] {
  if (cached !== null) return cached;
  const understanding = findDataDir();
  const root = understanding ? join(dirname(understanding), 'standards') : null;
  const latest =
    root !== null && existsSync(root)
      ? readdirSync(root)
          .filter((d) => existsSync(join(root, d, 'standards.json')))
          .sort()
          .at(-1)
      : undefined;
  cached =
    root !== null && latest !== undefined
      ? standardRowsFrom(JSON.parse(readFileSync(join(root, latest, 'standards.json'), 'utf8')))
      : [];
  return cached;
}
