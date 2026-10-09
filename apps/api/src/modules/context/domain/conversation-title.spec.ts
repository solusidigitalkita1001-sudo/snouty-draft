import { describe, expect, it } from 'vitest';
import type { ConversationSubject, RequirementState } from '@snouty/shared-types';
import { mergeRequirement } from './context-merger.js';
import { emptyRequirementState } from './requirement-state.factory.js';
import { conversationTitle } from './conversation-title.js';

const T0 = '2026-01-01T00:00:00.000Z';
const empty = emptyRequirementState(T0);
const withSubject = (subject: ConversationSubject): RequirementState => ({ ...empty, subject });
const building = (type: string, floors: number | null) =>
  mergeRequirement(
    empty,
    [
      { path: 'building.type', value: type, source: 'user_stated' },
      ...(floors !== null
        ? [{ path: 'building.floors' as const, value: floors, source: 'user_stated' as const }]
        : []),
    ],
    T0,
  ).state;

describe('conversationTitle (riwayat dari isi, bukan "Hai")', () => {
  it('kebutuhan bangunan → jenis dan lantainya', () => {
    expect(conversationTitle(building('residential', 3), 'id')).toBe('Rumah 3 lantai');
    expect(conversationTitle(building('light_commercial', 2), 'id')).toBe('Bangunan 2 lantai');
    expect(conversationTitle(building('residential', 3), 'en')).toBe('3-storey house');
  });

  it('subjek produk / perbandingan / perusahaan', () => {
    const p = (entity: string, topic = 'product_overview') =>
      conversationTitle(withSubject({ kind: 'product', entity, topic, depth: 'standard' }), 'id');
    expect(p('hdpe')).toBe('Produk HDPE');
    expect(p('pvc dan hdpe', 'comparison')).toBe('PVC vs HDPE');
    // Subjek umum atau bukan produk tidak mengganti judul yang ada.
    expect(p('Pralon')).toBeNull();
    expect(p('building')).toBeNull();
    expect(
      conversationTitle(
        withSubject({
          kind: 'company',
          entity: 'PT Pralon',
          topic: 'company_overview',
          depth: 'standard',
        }),
        'id',
      ),
    ).toBe('Tentang PT Pralon');
  });

  it('kasus bangunan menang atas subjek produk/perusahaan di tengah percakapan', () => {
    const house = building('residential', 2);
    expect(
      conversationTitle(
        {
          ...house,
          subject: { kind: 'company', entity: 'PT Pralon', topic: 'contact', depth: 'standard' },
        },
        'id',
      ),
    ).toBe('Rumah 2 lantai');
  });

  it('hanya sapaan (state kosong) → null; judul yang ada dibiarkan', () => {
    expect(conversationTitle(empty, 'id')).toBeNull();
    expect(conversationTitle(null, 'id')).toBeNull();
  });
});
