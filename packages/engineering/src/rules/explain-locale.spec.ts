/**
 * P15-04b — penjelasan trace setiap aturan dalam dua bahasa.
 *
 * Untuk setiap aturan terdaftar dan setiap test case-nya: bawaan tetap Indonesia, versi
 * Inggris ada dan berbeda, dan angka yang disebut kedua versi sama persis. Yang terakhir
 * menjaga terjemahan agar tidak pernah mengubah, menghilangkan, atau menambah angka teknik.
 */
import { describe, expect, it } from 'vitest';
import { ALL_RULES } from '../index.js';

/** Himpunan angka dalam teks; koma desimal Indonesia dinormalkan ke titik. */
function numbersIn(text: string): string[] {
  const found = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return [...new Set(found.map((n) => n.replace(',', '.')))].sort();
}

describe('explain dua bahasa untuk setiap aturan', () => {
  for (const rule of ALL_RULES) {
    for (const testCase of rule.testCases) {
      it(`${rule.ruleId}: ${testCase.name}`, () => {
        const input = rule.parseInput(testCase.input);
        const output = testCase.expected as never;
        const byDefault = rule.explain(input, output);
        const id = rule.explain(input, output, 'id');
        const en = rule.explain(input, output, 'en');

        expect(id).toBe(byDefault);
        expect(en.trim().length).toBeGreaterThan(10);
        expect(en).not.toBe(id);
        expect(numbersIn(en)).toEqual(numbersIn(id));
      });
    }
  }
});
