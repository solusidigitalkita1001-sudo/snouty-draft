import { describe, expect, it } from 'vitest';
import { handoffMessage } from './handoff-message.js';
import type { HandoffRow } from './handoff.repository.js';

const row: HandoffRow = {
  id: '01JBHANDOFF000000000000000',
  conversationId: '01JBC0NV0000000000000000AB',
  reason: 'Air panas di atas 45°C perlu pilihan pipa tersendiri.',
  captured: [
    { label: 'Jumlah lantai', value: '2' },
    { label: 'Suhu air', value: '80 °C' },
    { label: 'asumsi:building.floorHeightM', value: 'Tinggi lantai diasumsikan 3,5 m.' },
    { label: 'lampiran:01JBUPL0AD000000000000000A', value: 'denah.pdf (1,2 MB)' },
  ],
  status: 'QUEUED',
  assignedTo: null,
  createdAt: new Date('2026-10-08T10:00:00.000Z'),
  resolvedAt: null,
};

describe('handoffMessage (P10-06)', () => {
  it('memisahkan kebutuhan pengguna, asumsi sistem, dan lampiran', () => {
    const m = handoffMessage(row);
    expect(m.subject).toBe(
      '[SNOUTY] Kasus untuk tim teknis — Air panas di atas 45°C perlu pilihan pipa tersendiri.',
    );
    expect(m.text).toContain('Kebutuhan dari pengguna:\n- Jumlah lantai: 2\n- Suhu air: 80 °C');
    expect(m.text).toContain(
      'Asumsi sistem (perlu diperiksa):\n- Tinggi lantai diasumsikan 3,5 m.',
    );
    expect(m.text).toContain('- 01JBUPL0AD000000000000000A: denah.pdf (1,2 MB)');
    expect(m.text).toContain('ID percakapan: 01JBC0NV0000000000000000AB');
  });

  it('isian pengguna tidak bisa memecah baris subjek atau isi', () => {
    const m = handoffMessage({
      ...row,
      reason: 'baris satu\r\nBcc: orang@lain.test',
      captured: [{ label: 'Catatan', value: 'a\nb' }],
    });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.text).toContain('- Catatan: a b');
    expect(handoffMessage({ ...row, captured: [] }).text).toContain('- (belum ada yang tercatat)');
  });

  it('subjek dipotong untuk alasan panjang', () => {
    const m = handoffMessage({ ...row, reason: 'x'.repeat(200) });
    expect(m.subject.length).toBeLessThan(130);
    expect(m.subject.endsWith('…')).toBe(true);
  });
});
