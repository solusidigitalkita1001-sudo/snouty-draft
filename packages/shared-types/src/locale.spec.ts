import { describe, expect, it } from 'vitest';
import { isLocale, localeFromAcceptLanguage } from './locale.js';

describe('locale', () => {
  it('hanya id dan en yang sah', () => {
    expect(isLocale('id')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('EN')).toBe(false);
    expect(isLocale('jv')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it('Accept-Language: tag pertama yang didukung menang; tanpa header atau tak dikenal → id', () => {
    expect(localeFromAcceptLanguage('en-US,en;q=0.9,id;q=0.8')).toBe('en');
    expect(localeFromAcceptLanguage('id-ID,id;q=0.9,en;q=0.8')).toBe('id');
    expect(localeFromAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.5')).toBe('en');
    expect(localeFromAcceptLanguage('ja')).toBe('id');
    expect(localeFromAcceptLanguage(undefined)).toBe('id');
  });
});
