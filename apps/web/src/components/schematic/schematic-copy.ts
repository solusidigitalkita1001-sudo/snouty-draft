/**
 * Teks skema (layar 09 dan pratinjau layar 06), apa adanya dari desain.
 *
 * Dua penegasan di `MANDATORY_NOTES` **tidak boleh diparafrase dan tidak boleh
 * disembunyikan** (invarian S-1). Keduanya bukan disclaimer hukum yang ditempel
 * belakangan, melainkan pernyataan tepat tentang apa yang sistem memang tahu: ia tidak
 * punya denah bangunan, jadi ia tidak tahu posisi fisik apa pun.
 */

import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

export const SCHEMATIC_COPY = {
  title: 'Skema Instalasi',
  routeListTitle: 'DAFTAR JALUR',
  titleBlockLabels: {
    drawing: 'GAMBAR',
    scale: 'SKALA',
    floorHeight: 'TINGGI LANTAI',
    basis: 'DASAR',
    source: 'SUMBER',
  },
  legend: [
    { label: 'Jalur utama & riser', role: 'main' as const },
    { label: 'Cabang per lantai', role: 'branch' as const },
    { label: 'Sambungan fixture', role: 'fixture_connection' as const },
    { label: 'Tee + reducer', role: 'fitting' as const },
  ],
  groundLabel: '±0.00 MUKA TANAH',
  /** Alternatif teks untuk pembaca layar (§8) — ringkasan terstruktur, bukan "gambar". */
  ariaIntro: 'Skema instalasi air bersih, disajikan sebagai daftar jalur per lantai.',
  flowAriaIntro: 'Skema aliran instalasi, dari sumber sampai titik ujung.',
  textAlternative: 'Uraian skema dalam teks',
  flowLegend: [
    { label: 'Jalur utama & riser', role: 'main' as const },
    { label: 'Cabang', role: 'branch' as const },
    { label: 'Sambungan titik', role: 'fixture_connection' as const },
  ],
  flowRoles: {
    main: 'Jalur utama',
    riser: 'Riser',
    branch: 'Cabang',
    drain: 'Saluran',
    fixture_connection: 'Sambungan titik',
  },
} as const;

export const SCHEMATIC_COPY_EN: CopyShape<typeof SCHEMATIC_COPY> = {
  title: 'Installation Schematic',
  routeListTitle: 'ROUTE LIST',
  titleBlockLabels: {
    drawing: 'DRAWING',
    scale: 'SCALE',
    floorHeight: 'FLOOR HEIGHT',
    basis: 'BASIS',
    source: 'SOURCE',
  },
  legend: [
    { label: 'Main line & riser', role: 'main' },
    { label: 'Branch per floor', role: 'branch' },
    { label: 'Fixture connection', role: 'fixture_connection' },
    { label: 'Tee + reducer', role: 'fitting' },
  ],
  groundLabel: '±0.00 GROUND LEVEL',
  ariaIntro: 'Clean water installation schematic, presented as a list of routes per floor.',
  flowAriaIntro: 'Installation flow schematic, from the source to the end points.',
  textAlternative: 'Schematic described in text',
  flowLegend: [
    { label: 'Main line & riser', role: 'main' },
    { label: 'Branch', role: 'branch' },
    { label: 'Outlet connection', role: 'fixture_connection' },
  ],
  flowRoles: {
    main: 'Main line',
    riser: 'Riser',
    branch: 'Branch',
    drain: 'Drain',
    fixture_connection: 'Outlet connection',
  },
};

export function schematicCopy(locale: Locale): CopyShape<typeof SCHEMATIC_COPY> {
  return pickCopy(locale, SCHEMATIC_COPY, SCHEMATIC_COPY_EN);
}

/** Invarian S-1 — tidak ada mode yang menghilangkan keduanya. */
export const MANDATORY_NOTES = {
  banner: 'SKEMATIK · BUKAN GAMBAR KERJA',
  noteTitle: 'CATATAN SKEMA',
  noteBody:
    'Skema menunjukkan hubungan antar jalur, bukan posisi fisik pipa di bangunan. Panjang jalur dan posisi shaft ditentukan saat pelaksanaan.',
} as const;

export const MANDATORY_NOTES_EN: CopyShape<typeof MANDATORY_NOTES> = {
  banner: 'SCHEMATIC · NOT A WORKING DRAWING',
  noteTitle: 'SCHEMATIC NOTE',
  noteBody:
    'The schematic shows how routes relate to each other, not the physical position of pipes in the building. Route lengths and shaft positions are determined during construction.',
};

export function mandatoryNotes(locale: Locale): CopyShape<typeof MANDATORY_NOTES> {
  return pickCopy(locale, MANDATORY_NOTES, MANDATORY_NOTES_EN);
}
