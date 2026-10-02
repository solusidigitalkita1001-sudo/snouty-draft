/**
 * Back-office minimal (OQ-21). Yang diuji bukan tampilannya — itu akan diganti — melainkan
 * tiga hal yang harus tetap benar:
 *
 *   1. Penanda "menunggu desain" tidak bisa disembunyikan.
 *   2. Setiap bagian mengatakan **apa yang menunggu jawaban mana**. Halaman kosong tanpa
 *      penjelasan membuat "belum dibangun" dan "menunggu keputusan" terlihat sama.
 *   3. Mascot tidak dipakai di back-office — ini alat kerja, bukan permukaan produk.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INTERNAL_COPY, type InternalSection } from './internal-copy';
import { InternalShell } from './internal-shell';

const SECTIONS: readonly InternalSection[] = ['katalog', 'aturan', 'email', 'pasar', 'handoff'];

describe('penanda "menunggu desain"', () => {
  it('tampil di setiap bagian', () => {
    for (const section of SECTIONS) {
      const { unmount } = render(<InternalShell section={section} />);
      expect(screen.getByText(INTERNAL_COPY.needsDesign), section).toBeDefined();
      unmount();
    }
  });

  it('tidak ada prop yang bisa menyembunyikannya', () => {
    expect(InternalShell.length).toBe(1);
  });
});

describe('setiap bagian menjelaskan apa yang menunggu apa', () => {
  it('menyebut OQ atau keadaan yang menahannya', () => {
    for (const section of SECTIONS) {
      const { unmount } = render(<InternalShell section={section} />);
      const blocked = INTERNAL_COPY[section].blocked;
      expect(screen.getByText(blocked), section).toBeDefined();
      // Penjelasan yang tidak menyebut sebab tidak membantu siapa pun.
      expect(blocked.length, section).toBeGreaterThan(40);
      unmount();
    }
  });

  it('bagian katalog menyebut OQ-07, aturan menyebut OQ-06', () => {
    expect(INTERNAL_COPY.katalog.blocked).toContain('OQ-07');
    expect(INTERNAL_COPY.aturan.blocked).toContain('OQ-06');
  });

  it('bagian aturan menegaskan ASUMSI adalah perilaku yang benar, bukan kekurangan', () => {
    expect(INTERNAL_COPY.aturan.blocked).toContain('perilaku yang benar');
  });
});

describe('navigasi', () => {
  it('menautkan kelima bagian beserta nomor item fasenya', () => {
    render(<InternalShell section="katalog" />);
    for (const item of INTERNAL_COPY.nav) {
      expect(screen.getByText(item.label)).toBeDefined();
      expect(screen.getByText(item.phase)).toBeDefined();
    }
  });
});

describe('mascot tidak dipakai di back-office', () => {
  it('tidak merender satu pun gambar', () => {
    // Aturan dari skill desain. Back-office adalah alat kerja yang dipakai berjam-jam.
    const { container } = render(<InternalShell section="pasar" />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});
