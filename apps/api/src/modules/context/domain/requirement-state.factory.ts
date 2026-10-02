/**
 * State kebutuhan kosong — titik awal setiap percakapan baru.
 *
 * Semua field dimulai `value: null`, `provenance: 'UNAVAILABLE'`, `source:
 * 'inferred'`: belum ada yang diketahui, dan ketidaktahuan itu eksplisit, bukan
 * nol diam-diam. `version` mulai dari 0; snapshot pertama yang tersimpan naik ke 1.
 */

import type { RequirementState, TrackedValue } from '@snouty/shared-types';

function empty<T>(now: string): TrackedValue<T> {
  return { value: null, provenance: 'UNAVAILABLE', source: 'inferred', updatedAt: now };
}

export function emptyRequirementState(now: string): RequirementState {
  return {
    version: 0,
    intent: 'REQUIREMENT_STATEMENT',
    building: {
      type: empty(now),
      floors: empty(now),
      floorHeightM: empty(now),
      dimensions: empty(now),
    },
    fixtures: {
      bathrooms: empty(now),
      basins: empty(now),
      kitchens: empty(now),
      outletCount: empty(now),
    },
    water: {
      source: empty(now),
      installationType: empty(now),
      boosterPump: empty(now),
    },
    missingInformation: [],
    completeness: { filled: 0, required: 4 },
  };
}
