/**
 * P31-88 — daftar nomor standar sebagai data. Satu hal yang dipaku di sini lebih penting dari
 * isi daftarnya: teks bersumber SNOUTY sendiri tidak boleh tersandung pagarnya. Kalau sebuah
 * fakta di `pipe-facts.json` menyebut nomor yang tidak ada di daftar, yang salah adalah
 * daftarnya, dan tes ini yang memberitahu.
 */
import { describe, expect, it } from 'vitest';
import { knowledgeFacts } from './knowledge-facts.js';
import { knownStandards } from './known-standards.js';
import { standardCitationsIn, isKnownStandard } from '../domain/standard-citations.js';

describe('daftar nomor standar dari data', () => {
  it('terbaca dan memuat standar pipa Pralon', () => {
    const known = knownStandards();
    expect(known.has('SNI 06-0084-2002')).toBe(true);
    expect(known.has('ISO 4427')).toBe(true);
  });

  it('setiap nomor yang disebut fakta bersumber ada di daftar', () => {
    const known = knownStandards();
    const unknown = knowledgeFacts()
      .flatMap((fact) => [...standardCitationsIn(fact.text), ...standardCitationsIn(fact.textEn)])
      .filter((citation) => !isKnownStandard(citation, known));
    expect([...new Set(unknown)]).toEqual([]);
  });
});
