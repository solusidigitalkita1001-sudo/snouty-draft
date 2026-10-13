/** P17-05: peta gambar pilihan cocok dengan registry parameter — tidak ada nilai karangan. */
import { isParameterKey, parameterDefinition } from '@snouty/engineering';
import { SCENE_ILLUSTRATIONS } from '@snouty/ui/illustrations';
import { describe, expect, it } from 'vitest';
import { OPTION_ILLUSTRATIONS, optionIllustration } from './option-illustrations';

describe('OPTION_ILLUSTRATIONS', () => {
  const parameterKeys = Object.keys(OPTION_ILLUSTRATIONS).filter(isParameterKey);

  it('setiap nilai yang dipetakan memang pilihan registry, dan setiap pilihan registry bergambar', () => {
    expect(parameterKeys.length).toBeGreaterThan(10);
    for (const key of parameterKeys) {
      const options = parameterDefinition(key).options ?? [];
      expect(Object.keys(OPTION_ILLUSTRATIONS[key]!).sort(), key).toEqual([...options].sort());
    }
  });

  it('setiap gambar ada di pustaka ilustrasi', () => {
    const known = new Set<string>(SCENE_ILLUSTRATIONS);
    for (const map of Object.values(OPTION_ILLUSTRATIONS)) {
      for (const image of Object.values(map)) expect(known.has(image), image).toBe(true);
    }
  });

  it('"Belum tahu" bergambar tanya hanya di kartu bergambar; pertanyaan lain tanpa gambar', () => {
    expect(optionIllustration('water.source', 'PDAM', 'Belum tahu')).toBe('meter');
    expect(optionIllustration('water.source', 'Belum tahu', 'Belum tahu')).toBe('question');
    expect(optionIllustration('building.floors', '2', 'Belum tahu')).toBeNull();
  });
});
