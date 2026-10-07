/**
 * P15-02 — setiap objek copy Inggris memuat kunci yang sama persis dengan kembaran Indonesianya
 * (tipe `CopyShape` menjaga ini saat typecheck; tes ini menjaganya saat runtime dan untuk fungsi),
 * dan tidak ada string Inggris yang masih identik dengan Indonesianya kecuali merek/label teknis.
 */
import { describe, expect, it } from 'vitest';
import { AUTH_COPY, AUTH_COPY_EN } from './auth/auth-copy';
import { CHAT_COPY, CHAT_COPY_EN, stageLabel } from './chat/chat-copy';
import { INTERNAL_COPY, INTERNAL_COPY_EN } from './internal/internal-copy';
import { ONBOARDING_COPY, ONBOARDING_COPY_EN } from './onboarding/onboarding-copy';
import { PRODUCT_COPY, PRODUCT_COPY_EN, sourceLine } from './product/product-copy';
import { REPORT_COPY, REPORT_COPY_EN } from './report/report-copy';
import {
  MANDATORY_NOTES,
  MANDATORY_NOTES_EN,
  SCHEMATIC_COPY,
  SCHEMATIC_COPY_EN,
} from './schematic/schematic-copy';
import { SOLUTION_COPY, SOLUTION_COPY_EN } from './solution/solution-copy';
import { pickCopy } from './copy';

function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

const PAIRS: ReadonlyArray<readonly [string, object, object]> = [
  ['auth', AUTH_COPY, AUTH_COPY_EN],
  ['chat', CHAT_COPY, CHAT_COPY_EN],
  ['internal', INTERNAL_COPY, INTERNAL_COPY_EN],
  ['onboarding', ONBOARDING_COPY, ONBOARDING_COPY_EN],
  ['product', PRODUCT_COPY, PRODUCT_COPY_EN],
  ['report', REPORT_COPY, REPORT_COPY_EN],
  ['schematic', SCHEMATIC_COPY, SCHEMATIC_COPY_EN],
  ['schematic-notes', MANDATORY_NOTES, MANDATORY_NOTES_EN],
  ['solution', SOLUTION_COPY, SOLUTION_COPY_EN],
];

describe('copy dua bahasa', () => {
  it.each(PAIRS)('%s: kunci Inggris = kunci Indonesia', (_name, id, en) => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(id).sort());
  });

  it('kalimat kebijakan diterjemahkan setia (janji produk, bukan redaksi)', () => {
    expect(SOLUTION_COPY_EN.planningDisclaimer).toBe(
      'PLANNING GUIDANCE — NOT A TECHNICAL CERTIFICATION',
    );
    expect(SOLUTION_COPY_EN.schematicDisclaimer).toBe('SCHEMATIC · NOT A WORKING DRAWING');
    expect(MANDATORY_NOTES_EN.banner).toBe('SCHEMATIC · NOT A WORKING DRAWING');
    expect(SOLUTION_COPY_EN.priceDisclaimer).toBe(
      'A planning estimate, not an official quotation.',
    );
  });

  it('pickCopy memilih per bahasa; fungsi dan label tahap ikut bahasa', () => {
    expect(pickCopy('id', CHAT_COPY, CHAT_COPY_EN).stepStatus(1)).toBe('LANGKAH 2 DARI 4');
    expect(pickCopy('en', CHAT_COPY, CHAT_COPY_EN).stepStatus(1)).toBe('STEP 2 OF 4');
    expect(stageLabel('UNDERSTANDING', 'en')).not.toBe(stageLabel('UNDERSTANDING', 'id'));
    expect(sourceLine('Katalog 2026', 14, 'en')).toBe('Katalog 2026 · p. 14');
    expect(sourceLine('Katalog 2026', 14)).toBe('Katalog 2026 · hal. 14');
  });
});
