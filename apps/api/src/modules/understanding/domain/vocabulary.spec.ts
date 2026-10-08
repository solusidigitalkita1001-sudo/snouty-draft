/**
 * Kosakata entitas: nama dikenali pada batas kata, alias terpanjang menang, urutan kemunculan
 * dijaga, dan nama yang menjadi bagian nama lain tidak dihitung dua kali.
 */
import { describe, expect, it } from 'vitest';
import { EntityLexicon, VocabularySchema } from './vocabulary.js';

const lexicon = new EntityLexicon(
  VocabularySchema.parse({
    ownBrand: ['pralon', 'pt pralon'],
    productFamilies: {
      pvc: ['pvc', 'paralon'],
      'pvc aw': ['pvc aw', 'aw', 'pipa aw'],
      hdpe: ['hdpe', 'pe 100'],
      galvanis: ['besi'],
    },
    competitorBrands: ['rucika'],
    competitorReferences: ['merek lain'],
    requirementEntities: ['rumah', 'kamar mandi', 'floors'],
  }),
);

describe('EntityLexicon', () => {
  it('keluarga produk: kanonis, urut kemunculan, alias terpanjang menang ("pvc aw" bukan "pvc" + "aw")', () => {
    expect(lexicon.productFamilies('apa bedanya HDPE sama PVC AW?')).toEqual(['hdpe', 'pvc aw']);
    expect(lexicon.productFamilies('pipa AW ada ukuran 3/4?')).toEqual(['pvc aw']);
    expect(lexicon.productFamilies('PE 100 dan paralon')).toEqual(['hdpe', 'pvc']);
    expect(lexicon.productFamilies('pvc, pvc, dan pvc lagi')).toEqual(['pvc']);
  });

  it('batas kata: "awal" bukan AW, "hdpex" bukan HDPE, "besi" di "besinya" tetap dikenali hanya bila berdiri sendiri', () => {
    expect(lexicon.productFamilies('awal mula pralon')).toEqual([]);
    expect(lexicon.productFamilies('hdpex')).toEqual([]);
    expect(lexicon.productFamilies('pipa besi vs pvc')).toEqual(['galvanis', 'pvc']);
  });

  it('merek sendiri, pesaing (merek atau rujukan), dan hal-hal kebutuhan', () => {
    expect(lexicon.mentionsOwnBrand('PT Pralon yang gw maksud')).toBe(true);
    expect(lexicon.mentionsOwnBrand('pralonnya')).toBe(false);
    expect(lexicon.mentionsCompetitor('pralon vs rucika')).toBe(true);
    expect(lexicon.mentionsCompetitor('dibanding merek lain gimana?')).toBe(true);
    expect(lexicon.mentionsCompetitor('produk pralon yang terkenal apa?')).toBe(false);
    expect(lexicon.mentionsRequirementEntity('rumah 2 lantai, 3 kamar mandi')).toBe(true);
    expect(lexicon.mentionsRequirementEntity('two floors, three bathrooms')).toBe(true);
    expect(lexicon.mentionsRequirementEntity('apa itu pvc?')).toBe(false);
  });

  it('skema menolak kosakata tanpa merek sendiri atau keluarga tanpa alias', () => {
    expect(() =>
      VocabularySchema.parse({
        ownBrand: [],
        productFamilies: {},
        competitorBrands: [],
        competitorReferences: [],
        requirementEntities: [],
      }),
    ).toThrow();
    expect(() =>
      VocabularySchema.parse({
        ownBrand: ['x'],
        productFamilies: { pvc: [] },
        competitorBrands: [],
        competitorReferences: [],
        requirementEntities: [],
      }),
    ).toThrow();
  });
});
