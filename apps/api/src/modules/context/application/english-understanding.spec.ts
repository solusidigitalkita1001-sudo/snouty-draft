/**
 * P15-03 — pemahaman kalimat Inggris: kosakata entitas dua bahasa, jalur cepat, intent pasti dari
 * pemahaman, fakta dari teks, pagar angka, kebijakan cakupan, dan templat jawaban/klarifikasi.
 * Bentuk kalimatnya dikenali modul `understanding` (contoh dua bahasa di data); di sini label
 * itu diberikan tes, dan yang diuji adalah aturan kode di atasnya.
 */
import { describe, expect, it } from 'vitest';
import { parseTemperature } from '../domain/temperature-parser.js';
import { useCasePolicy } from '../../policy/scope.js';
import { TEST_LEXICON, understood } from '../../understanding/testing/understood.js';
import { planClarification, summarizeAnswers } from '../domain/clarification.js';
import { extractionToUpdates } from './extraction-to-updates.js';
import { certainIntent, fastPathIntent } from './intent-router.js';
import { openerReply, replyFor } from './reply-copy.js';

describe('pemahaman Inggris — pola kode', () => {
  it('kosakata entitas dua bahasa dan jalur cepat mengenali kalimat Inggris', () => {
    expect(
      TEST_LEXICON.mentionsRequirementEntity('2-storey house, 3 bathrooms, rooftop tank'),
    ).toBe(true);
    expect(
      TEST_LEXICON.productFamilies('which is better, PVC or HDPE for a 2-storey house?'),
    ).toEqual(['pvc', 'hdpe']);
    expect(TEST_LEXICON.mentionsCompetitor('is Pralon better than Rucika?')).toBe(true);
    expect(
      fastPathIntent(
        understood('2-storey house, 3 bathrooms, rooftop tank', { intent: null }),
        false,
      ),
    ).toMatchObject({ intent: 'REQUIREMENT_STATEMENT' });
    // Pertanyaan "kenapa" yang dikenali tidak lewat jalur cepat kebutuhan.
    expect(
      fastPathIntent(
        understood('why is the main line 1 inch?', { intent: 'explanation_request' }),
        false,
      ),
    ).toBeNull();
  });

  it('intent pasti tanpa model: sapaan, pesaing, konsep produk, kasus teknis', () => {
    expect(certainIntent(understood('hello', { intent: 'greeting' }), false)?.intent).toBe(
      'OUT_OF_SCOPE',
    );
    expect(
      certainIntent(
        understood('is Pralon better than Rucika?', { intent: 'competitor_question' }),
        false,
      )?.intent,
    ).toBe('COMPETITOR_QUESTION');
    expect(
      certainIntent(
        understood('what is the difference between PVC and HDPE?', {
          intent: 'product_comparison',
        }),
        false,
      )?.intent,
    ).toBe('PRODUCT_LOOKUP');
    expect(
      certainIntent(
        understood('rainwater drainage for a parking lot', { intent: 'requirement_technical' }),
        false,
      )?.intent,
    ).toBe('REQUIREMENT_STATEMENT');
    // Yang tidak mirip contoh mana pun tetap ragu — model generatif yang memutuskan.
    expect(
      certainIntent(understood('my invoice number is 12345', { intent: null }), false),
    ).toBeNull();
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

  it('kebijakan cakupan membaca kondisi fluida dua bahasa (kosakata + parser suhu)', () => {
    const signals = (text: string) => ({
      outOfScopeFluid: TEST_LEXICON.mentionsOutOfScopeFluid(text),
      temperatureC: parseTemperature(text),
    });
    expect(useCasePolicy(signals('hot water line for a hotel boiler')).kind).toBe('policy');
    expect(useCasePolicy(signals('process water at 70 degrees C, 200 m run')).kind).toBe('policy');
    expect(useCasePolicy(signals('2-storey house, 3 bathrooms')).kind).toBe('supported');
    expect(useCasePolicy(signals('jalur air panas boiler hotel')).kind).toBe('policy');
    expect(useCasePolicy(signals('pipa untuk air suhu 60 derajat')).kind).toBe('policy');
    expect(useCasePolicy(signals('rumah 2 lantai suhu 30 derajat di luar')).kind).toBe('supported');
    expect(useCasePolicy(signals('pipa tambak udang 2 hektar')).kind).toBe('supported');
    expect(useCasePolicy(signals('irigasi sawah 1 hektar')).kind).toBe('supported');
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
