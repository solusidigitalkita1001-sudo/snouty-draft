import { describe, expect, it } from 'vitest';
import { classifyCase } from './classifier.js';

describe('classifyCase — English synonyms', () => {
  it.each([
    [
      'transfer water from a well to a tank, 5 liters per second, 800 m, 12 m higher',
      'pump_transfer',
    ],
    ['fish pond 4 x 4 m, 1.2 m deep', 'fish_pond'],
    ['I want to raise tilapia in a biofloc tank', 'fish_pond'],
    ['rainwater drainage for a 2 hectare parking lot, slope 1%', 'stormwater'],
    ['culvert under a 6 m road for trucks', 'culvert'],
    ['pipe under the road crossing', 'culvert'],
    ['housing estate with 40 houses, 300 m main line', 'residential_cluster'],
    ['irrigation for a 2 hectare rice field with sprinklers', 'irrigation'],
    ['sewage and wastewater drain to a septic tank by gravity', 'gravity_drainage'],
    ['submersible pump for a deep well', 'well_distribution'],
    ['12 storeys apartment tower water supply', 'multistorey_building_water'],
  ] as const)('"%s" → %s', (message, expected) => {
    expect(classifyCase(message).primary).toBe(expected);
  });
});

describe('classifyCase — Indonesian unchanged', () => {
  it.each([
    ['kolam lele 4 x 4 m', 'fish_pond'],
    ['gorong-gorong melintasi jalan', 'culvert'],
    ['drainase air hujan di lahan parkir', 'stormwater'],
    ['irigasi sawah 2 hektar', 'irrigation'],
    ['perumahan 40 unit', 'residential_cluster'],
    ['sumur bor 60 m', 'well_distribution'],
  ] as const)('"%s" → %s', (message, expected) => {
    expect(classifyCase(message).primary).toBe(expected);
  });
});
