/**
 * P28-04 — back-office dulu punya dua sidebar yang tidak saling menyebut, dan separuh "alat"
 * tidak punya satu pun tautan dari dalam aplikasi: layar katalog hanya bisa dibuka dengan
 * mengetik alamatnya. Yang dipaku di sini: satu daftar, dan perannya menentukan isinya.
 */
import { describe, expect, it } from 'vitest';
import { backOfficeLinks, boardLinks, toolLinks } from './back-office-nav';

const user = (...roles: string[]) => ({ name: 'Uji', tier: 'registered' as const, roles });

describe('navigasi back-office', () => {
  it('admin melihat papan prospek DAN alat yang boleh dibukanya', () => {
    const hrefs = backOfficeLinks(user('admin'), 'id').map((l) => l.href);
    expect(hrefs).toContain('/internal/prospects');
    expect(hrefs).toContain('/internal/market');
    expect(hrefs).toContain('/internal/handoff');
  });

  it('katalog hanya untuk pemegang catalog_admin', () => {
    expect(toolLinks(user('admin'), 'id').map((l) => l.section)).not.toContain('catalog');
    expect(toolLinks(user('catalog_admin'), 'id').map((l) => l.section)).toContain('catalog');
  });

  it('antrean teknis hanya untuk admin — API pun menolak yang lain', () => {
    expect(toolLinks(user('catalog_admin'), 'id').map((l) => l.section)).not.toContain('handoff');
    expect(toolLinks(user('admin'), 'id').map((l) => l.section)).toContain('handoff');
  });

  it('sales hanya melihat prospeknya sendiri, bukan seluruh papan', () => {
    expect(boardLinks(user('sales'), 'id').map((l) => l.section)).toEqual(['leads']);
  });

  it('tamu tidak melihat apa pun', () => {
    expect(backOfficeLinks(null, 'id')).toEqual([]);
  });

  it('pasar tidak muncul dua kali walau kedua daftar menyebutnya', () => {
    const sections = backOfficeLinks(user('admin'), 'id').map((l) => l.section);
    expect(sections.filter((s) => s === 'market')).toHaveLength(1);
  });

  it('label ikut bahasa', () => {
    expect(boardLinks(user('admin'), 'en').map((l) => l.label)).toContain('Prospects');
  });
});
