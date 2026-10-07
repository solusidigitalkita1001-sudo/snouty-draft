/**
 * P15-03 — pemahaman kalimat Inggris lewat pola deterministik: isyarat kebutuhan, jalur cepat,
 * fakta dari teks, pagar angka, kebijakan cakupan, dan templat jawaban/klarifikasi dua bahasa.
 */
import { describe, expect, it } from 'vitest';
import { certainIntent } from '../../ai/domain/heuristics.js';
import { useCasePolicy } from '../../policy/scope.js';
import { planClarification, summarizeAnswers } from '../domain/clarification.js';
import { hasRequirementSignals, asksAdvice } from '../domain/message-signals.js';
import { extractionToUpdates } from './extraction-to-updates.js';
import { fastPathIntent } from './intent-router.js';
import { openerReply, replyFor } from './reply-copy.js';

describe('pemahaman Inggris — pola kode', () => {
  it('isyarat kebutuhan, nasihat, dan jalur cepat mengenali kalimat Inggris', () => {
    expect(hasRequirementSignals('2-storey house, 3 bathrooms, rooftop tank')).toBe(true);
    expect(asksAdvice('which is better, PVC or HDPE for a 2-storey house?')).toBe(true);
    expect(fastPathIntent('2-storey house, 3 bathrooms, rooftop tank', false)).toMatchObject({
      intent: 'REQUIREMENT_STATEMENT',
    });
    expect(fastPathIntent('why is the main line 1 inch?', false)).toBeNull();
  });

  it('intent pasti tanpa model: sapaan, pesaing, konsep produk, kasus teknis', () => {
    expect(certainIntent('hello')?.intent).toBe('OUT_OF_SCOPE');
    expect(certainIntent('is Pralon better than Rucika?')?.intent).toBe('COMPETITOR_QUESTION');
    expect(certainIntent('what is the difference between PVC and HDPE?')?.intent).toBe(
      'PRODUCT_LOOKUP',
    );
    expect(certainIntent('rainwater drainage for a parking lot')?.intent).toBe(
      'REQUIREMENT_STATEMENT',
    );
  });

  it('fakta tersurat dari teks Inggris, model diam', () => {
    const updates = extractionToUpdates(
      {},
      '2-storey house, 3 bathrooms, water from a rooftop tank',
    );
    expect(updates).toEqual([
      { path: 'building.type', value: 'residential', source: 'user_stated' },
      { path: 'building.floors', value: 2, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 3, source: 'user_stated' },
      { path: 'water.source', value: 'rooftop_tank', source: 'user_stated' },
    ]);
    expect(extractionToUpdates({}, 'clean water for a new one-floor house')).toContainEqual({
      path: 'water.installationType',
      value: 'clean_water',
      source: 'user_stated',
    });
    expect(extractionToUpdates({}, 'boarding house with municipal water')).toEqual([
      { path: 'building.type', value: 'boarding_house', source: 'user_stated' },
      { path: 'water.source', value: 'municipal', source: 'user_stated' },
    ]);
  });

  it('pagar angka memakai kata bilangan dan kata benda Inggris; peniadaan "no kitchen" = 0', () => {
    const fabricated = { building: { floors: 2 }, fixtures: { bathrooms: 3, kitchens: 1 } };
    expect(extractionToUpdates(fabricated, 'two-storey house with three bathrooms')).toEqual([
      { path: 'building.type', value: 'residential', source: 'user_stated' },
      { path: 'building.floors', value: 2, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 3, source: 'user_stated' },
    ]);
    expect(
      extractionToUpdates({ fixtures: { kitchens: 0 } }, 'a house with no kitchen'),
    ).toContainEqual({ path: 'fixtures.kitchens', value: 0, source: 'user_stated' });
    expect(
      extractionToUpdates({ fixtures: { bathrooms: 1 } }, 'small house with a bathroom'),
    ).toContainEqual({ path: 'fixtures.bathrooms', value: 1, source: 'user_stated' });
  });

  it('kebijakan cakupan membaca kondisi fluida Inggris', () => {
    expect(useCasePolicy('hot water line for a hotel boiler').kind).toBe('policy');
    expect(useCasePolicy('process water at 70 degrees C, 200 m run').kind).toBe('policy');
    expect(useCasePolicy('2-storey house, 3 bathrooms').kind).toBe('supported');
  });

  it('templat dua bahasa: balasan tetap, pembuka, pertanyaan klarifikasi, ringkasan jawaban', () => {
    expect(replyFor('OUT_OF_SCOPE', 'en')).toContain('SNOUTY');
    expect(replyFor('OUT_OF_SCOPE', 'en')).not.toBe(replyFor('OUT_OF_SCOPE', 'id'));
    expect(openerReply('en')).toContain('Go ahead');
    const plan = planClarification(['water.source', 'building.floors', 'fixtures.bathrooms'], 'en');
    expect(plan?.questions[0]).toMatchObject({
      id: 'water.source',
      question: 'Where does the water come from?',
      options: ['Toren atap', 'Toren bawah', 'Pompa', 'PDAM'],
      optionLabels: ['Rooftop tank', 'Ground tank', 'Pump', 'Municipal water'],
    });
    expect(planClarification(['water.source'], 'id')?.questions[0]).not.toHaveProperty(
      'optionLabels',
    );
    expect(
      summarizeAnswers(
        [
          { id: 'water.source', option: 'Toren atap' },
          { id: 'building.floors', option: 'Belum tahu' },
        ],
        'en',
      ),
    ).toBe('Water source: Rooftop tank · Floors: Not sure');
  });
});
