/**
 * Pengalih tema: mengubah `data-theme` di <html> (selektor palet gelap di tokens.css) dan
 * menyimpan pilihannya; tanpa localStorage pun tetap berganti untuk sesi ini.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_INIT_SCRIPT, ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    delete document.documentElement.dataset['theme'];
    window.localStorage.clear();
  });

  it('klik → data-theme="dark" di <html> dan tersimpan; klik lagi → terang', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Mode gelap' }));
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(window.localStorage.getItem('snouty-theme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: 'Mode terang' }));
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('varian compact punya label aksesibel yang sama', () => {
    render(<ThemeToggle compact />);
    expect(screen.getByRole('button', { name: 'Mode gelap' })).toBeTruthy();
  });

  it('skrip init memasang tema tersimpan sebelum React', () => {
    window.localStorage.setItem('snouty-theme', 'dark');
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
