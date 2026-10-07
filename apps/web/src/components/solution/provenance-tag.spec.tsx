/**
 * Tes POLICY.md §11 #8 dan DESIGN_IMPLEMENTATION §6 — utang dari Fase 5/7 yang baru bisa
 * dibayar setelah lapisan tes komponen ada.
 *
 * Dua hal yang hanya bisa diuji di rendering:
 *   - "TERVERIFIKASI" hanya pernah muncul untuk `VERIFIED`.
 *   - `UNAVAILABLE` **tidak merender nilai sama sekali** — ia menampilkan "Lihat dokumen
 *     teknis". Mengisi kolom kosong dengan perkiraan adalah cara halus berhalusinasi.
 */
import { render, screen } from '@testing-library/react';
import type { Provenance } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '../locale';
import { ProvenanceTag, SpecCell } from './provenance-tag';

const ALL: readonly Provenance[] = ['VERIFIED', 'ASSUMED', 'ESTIMATED', 'UNAVAILABLE'];

describe('ProvenanceTag', () => {
  it('"TERVERIFIKASI" hanya untuk VERIFIED', () => {
    for (const provenance of ALL) {
      const { unmount, container } = render(<ProvenanceTag provenance={provenance} />);
      const text = container.textContent ?? '';
      if (provenance === 'VERIFIED') expect(text).toBe('TERVERIFIKASI');
      else expect(text).not.toContain('TERVERIFIKASI');
      unmount();
    }
  });

  it('setiap provenance membawa teks, bukan hanya warna', () => {
    // Bagi pengguna buta warna merah-hijau, perbedaan hijau/amber hilang total.
    for (const provenance of ALL) {
      const { unmount, container } = render(<ProvenanceTag provenance={provenance} />);
      expect((container.textContent ?? '').length).toBeGreaterThan(3);
      unmount();
    }
  });

  it('en: label Inggris sama dengan laporan PDF; "VERIFIED" hanya untuk VERIFIED', () => {
    for (const provenance of ALL) {
      const { unmount, container } = render(
        <LocaleProvider initial="en">
          <ProvenanceTag provenance={provenance} />
        </LocaleProvider>,
      );
      const text = container.textContent ?? '';
      if (provenance === 'VERIFIED') expect(text).toBe('VERIFIED');
      else expect(text).not.toContain('VERIFIED');
      expect(text).not.toContain('TERVERIFIKASI');
      unmount();
    }
  });

  it('hanya menerima Provenance — tidak ada prop label bebas', () => {
    expect(ProvenanceTag.length).toBe(1);
  });
});

describe('SpecCell', () => {
  it('UNAVAILABLE tidak merender nilai, hanya tawaran dokumen teknis', () => {
    render(<SpecCell value={null} provenance="UNAVAILABLE" />);
    expect(screen.getByText('Lihat dokumen teknis')).toBeDefined();
  });

  it('UNAVAILABLE dengan nilai yang entah bagaimana ada tetap tidak merendernya', () => {
    // Pertahanan lapis dua: tipe sudah melarangnya (P-2), tetapi data dari basis data
    // lama atau JSON bisa menyelipkannya.
    render(<SpecCell value="mungkin 10 bar" provenance="UNAVAILABLE" />);
    expect(screen.queryByText(/10 bar/)).toBeNull();
    expect(screen.getByText('Lihat dokumen teknis')).toBeDefined();
  });

  it('VERIFIED merender nilai beserta tag TERVERIFIKASI', () => {
    render(<SpecCell value="10 bar" provenance="VERIFIED" />);
    expect(screen.getByText(/10 bar/)).toBeDefined();
    expect(screen.getByText('TERVERIFIKASI')).toBeDefined();
  });

  it('nilai kosong diperlakukan seperti UNAVAILABLE', () => {
    render(<SpecCell value={null} provenance="VERIFIED" />);
    expect(screen.getByText('Lihat dokumen teknis')).toBeDefined();
  });
});
