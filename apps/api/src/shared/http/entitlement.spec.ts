/**
 * P3-11a — tamu tidak bisa menyentuh kapabilitas khusus terdaftar lewat API meski
 * UI dilewati. Guard-nya satu fungsi; tes ini memaku perilakunya untuk SEMUA
 * kapabilitas non-tamu, bukan contoh yang kebetulan dipilih.
 */
import { describe, expect, it } from 'vitest';
import { ENTITLEMENTS, type Capability } from '../../modules/policy/entitlements.js';
import { NotEntitledCapabilityError } from './api-errors.js';
import { requireEntitled } from './entitlement.js';

const ALL = Object.keys(ENTITLEMENTS) as Capability[];

describe('requireEntitled', () => {
  it('menolak tamu untuk SETIAP kapabilitas yang tidak memuat guest di tabel', () => {
    for (const capability of ALL.filter((c) => !ENTITLEMENTS[c].includes('guest'))) {
      expect(() => requireEntitled('guest', capability), capability).toThrow(
        NotEntitledCapabilityError,
      );
    }
  });

  it('meloloskan tamu untuk setiap kapabilitas yang memuat guest', () => {
    for (const capability of ALL.filter((c) => ENTITLEMENTS[c].includes('guest'))) {
      expect(() => requireEntitled('guest', capability), capability).not.toThrow();
    }
  });

  it('menolak registered untuk kapabilitas khusus advanced', () => {
    expect(() => requireEntitled('registered', 'MATERIAL_BOM')).toThrow(NotEntitledCapabilityError);
    expect(() => requireEntitled('advanced', 'MATERIAL_BOM')).not.toThrow();
  });

  it('menyebut kapabilitas yang kurang di details — UI memakainya untuk register-gate', () => {
    try {
      requireEntitled('guest', 'CONVERSATION_HISTORY');
      throw new Error('seharusnya ditolak');
    } catch (error) {
      expect((error as NotEntitledCapabilityError).details).toEqual({
        capability: 'CONVERSATION_HISTORY',
      });
    }
  });
});
