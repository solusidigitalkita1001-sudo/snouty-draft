/**
 * Fase 15 — registry berbahasa ganda. Yang dipaku: setiap parameter, profil, dan asumsi punya
 * teks Inggris yang sungguh diterjemahkan; pilihan enum sejajar dengan nilai protokol; dan
 * pengakses mengembalikan Indonesia untuk `id` (byte-identik dengan field asli) serta Inggris
 * untuk `en`.
 */
import { describe, expect, it } from 'vitest';
import {
  CASE_PROFILES,
  caseProfile,
  caseProfileDescription,
  caseProfileLabel,
} from '../cases/profiles.js';
import { resolveMissingParameters } from '../cases/missing.js';
import {
  ASSUMPTIONS,
  assumption,
  assumptionCondition,
  assumptionDescription,
} from './assumptions.js';
import { DEFAULT_ENGINEERING_LOCALE } from './locale.js';
import { OUTPUT_LABELS, OUTPUT_LABELS_EN, outputLabel, type OutputKey } from './readiness.js';
import {
  PARAMETERS,
  parameterDefinition,
  parameterLabel,
  parameterOptionLabels,
  parameterQuestion,
  parameterReason,
} from './registry.js';

/** Label/teks yang memang sama di kedua bahasa (istilah merek atau satuan). Kosong = tidak ada. */
const SAME_LABEL_ALLOWED: ReadonlySet<string> = new Set<string>([]);
const SAME_TEXT_ALLOWED: ReadonlySet<string> = new Set<string>([]);

describe('locale bawaan', () => {
  it('Indonesia', () => {
    expect(DEFAULT_ENGINEERING_LOCALE).toBe('id');
  });
});

describe('registry parameter berbahasa ganda', () => {
  it('setiap parameter punya label/pertanyaan/alasan Inggris yang berbeda dari Indonesia', () => {
    for (const p of PARAMETERS) {
      expect(p.labelEn.trim(), p.key).not.toBe('');
      expect(p.questionEn.trim(), p.key).not.toBe('');
      expect(p.reasonEn.trim(), p.key).not.toBe('');
      if (!SAME_LABEL_ALLOWED.has(p.key)) expect(p.labelEn, p.key).not.toBe(p.label);
      if (!SAME_TEXT_ALLOWED.has(p.key)) {
        expect(p.questionEn, p.key).not.toBe(p.question);
        expect(p.reasonEn, p.key).not.toBe(p.reason);
      }
    }
  });

  it('label pilihan enum sejajar dengan options', () => {
    for (const p of PARAMETERS) {
      if (p.kind !== 'enum') continue;
      expect(p.options, p.key).toBeDefined();
      expect(p.optionLabelsEn?.length, p.key).toBe(p.options?.length);
      for (const label of p.optionLabelsEn ?? []) expect(label.trim(), p.key).not.toBe('');
    }
  });

  it('pengakses: id = Indonesia, en = Inggris', () => {
    for (const p of PARAMETERS) {
      expect(parameterLabel(p.key, 'id')).toBe(p.label);
      expect(parameterQuestion(p.key, 'id')).toBe(p.question);
      expect(parameterReason(p.key, 'id')).toBe(p.reason);
      expect(parameterOptionLabels(p.key, 'id')).toEqual(p.options);
      expect(parameterLabel(p.key, 'en')).toBe(p.labelEn);
      expect(parameterQuestion(p.key, 'en')).toBe(p.questionEn);
      expect(parameterReason(p.key, 'en')).toBe(p.reasonEn);
      expect(parameterOptionLabels(p.key, 'en')).toEqual(p.optionLabelsEn ?? p.options);
    }
    expect(parameterLabel('static_head', 'en')).toBe('Static head');
    expect(parameterLabel('static_head', 'id')).toBe('Tinggi statis');
    expect(parameterOptionLabels('nominal_diameter', 'en')).toBeUndefined();
  });
});

describe('profil kasus berbahasa ganda', () => {
  it('setiap profil punya label dan deskripsi Inggris', () => {
    expect(CASE_PROFILES).toHaveLength(10);
    for (const p of CASE_PROFILES) {
      expect(p.labelEn.trim(), p.id).not.toBe('');
      expect(p.descriptionEn.trim(), p.id).not.toBe('');
      expect(p.labelEn, p.id).not.toBe(p.label);
      expect(p.descriptionEn, p.id).not.toBe(p.description);
    }
  });

  it('pengakses mengikuti locale', () => {
    for (const p of CASE_PROFILES) {
      expect(caseProfileLabel(p.id, 'id')).toBe(p.label);
      expect(caseProfileDescription(p.id, 'id')).toBe(p.description);
      expect(caseProfileLabel(p.id, 'en')).toBe(p.labelEn);
      expect(caseProfileDescription(p.id, 'en')).toBe(p.descriptionEn);
    }
  });
});

describe('parameter kurang membawa teks Inggris', () => {
  it('diisi dari registry tanpa mengubah urutan', () => {
    const missing = resolveMissingParameters({
      profile: caseProfile('stormwater'),
      known: new Set<string>(),
      assumed: new Set<string>(),
    });
    expect(missing.length).toBeGreaterThan(0);
    for (const m of missing) {
      const def = parameterDefinition(m.key);
      expect(m.label).toBe(def.label);
      expect(m.labelEn).toBe(def.labelEn);
      expect(m.questionEn).toBe(def.questionEn);
      expect(m.optionLabelsEn).toEqual(def.optionLabelsEn);
    }
  });
});

describe('label keluaran', () => {
  it('kunci EN sama dengan ID dan pengakses mengikuti locale', () => {
    expect(Object.keys(OUTPUT_LABELS_EN).sort()).toEqual(Object.keys(OUTPUT_LABELS).sort());
    for (const key of Object.keys(OUTPUT_LABELS) as OutputKey[]) {
      expect(outputLabel(key, 'id')).toBe(OUTPUT_LABELS[key]);
      expect(outputLabel(key, 'en')).toBe(OUTPUT_LABELS_EN[key]);
      expect(OUTPUT_LABELS_EN[key].trim()).not.toBe('');
      expect(OUTPUT_LABELS_EN[key]).not.toBe(OUTPUT_LABELS[key]);
    }
  });
});

describe('asumsi berbahasa ganda', () => {
  it('setiap asumsi punya condition/description Inggris', () => {
    for (const a of ASSUMPTIONS) {
      expect(a.conditionEn.trim(), a.id).not.toBe('');
      expect(a.descriptionEn.trim(), a.id).not.toBe('');
      expect(a.conditionEn, a.id).not.toBe(a.condition);
      expect(a.descriptionEn, a.id).not.toBe(a.description);
    }
  });

  it('angka pada deskripsi Inggris sama dengan Indonesia (mis. 1,5 -> 1.5)', () => {
    const numbers = (text: string) =>
      (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.')).sort();
    for (const a of ASSUMPTIONS) {
      expect(numbers(a.descriptionEn), a.id).toEqual(numbers(a.description));
    }
  });

  it('pengakses mengikuti locale', () => {
    for (const a of ASSUMPTIONS) {
      expect(assumptionDescription(a.id, 'id')).toBe(a.description);
      expect(assumptionCondition(a.id, 'id')).toBe(a.condition);
      expect(assumptionDescription(a.id, 'en')).toBe(a.descriptionEn);
      expect(assumptionCondition(a.id, 'en')).toBe(a.conditionEn);
    }
    expect(assumption('PEAK_HOUR_FACTOR_2').descriptionEn).toContain('2.0');
  });
});
