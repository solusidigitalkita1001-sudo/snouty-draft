/**
 * Layar alat yang menunggu orang (P31-81): bentuknya keadaan menunggu, dan kalimatnya tidak
 * menyebut jumlah aturan — angka itu sudah basi sejak mesin hitungnya tumbuh.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolNote } from './tool-note';

describe('alat internal yang menunggu orang', () => {
  it('validasi aturan tidak mengklaim jumlah aturan', () => {
    render(<ToolNote section="rules" />);
    const body = screen.getByText(/menunggu persetujuan ahli pipa Pralon/);
    expect(body.textContent).not.toMatch(/belas|[0-9]+ aturan/);
  });

  it('peninjauan email mengatakan kotak masuknya belum tersambung', () => {
    render(<ToolNote section="email" />);
    expect(screen.getByText(/Kotak masuknya belum tersambung/)).toBeDefined();
  });
});
