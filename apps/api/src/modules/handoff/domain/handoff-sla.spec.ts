import { describe, expect, it } from 'vitest';
import { isOverdue, slaDueAt } from './handoff-sla.js';

/** Waktu WIB sebagai instant UTC — tesnya ditulis dalam jam yang dilihat orang Pralon. */
function wib(iso: string): Date {
  return new Date(`${iso}+07:00`);
}

describe('tenggat 1×24 jam kerja', () => {
  it('di tengah minggu, tenggatnya hari berikutnya pada jam yang sama', () => {
    // Selasa 10:00 WIB → Rabu 10:00 WIB.
    expect(slaDueAt(wib('2026-10-20T10:00:00'), 24)).toEqual(wib('2026-10-21T10:00:00'));
  });

  it('akhir pekan tidak memakan jam kerja', () => {
    // Jumat 15:00 → Senin 15:00: Sabtu dan Minggu dilewati utuh.
    expect(slaDueAt(wib('2026-10-23T15:00:00'), 24)).toEqual(wib('2026-10-26T15:00:00'));
  });

  it('kasus yang masuk Sabtu baru mulai dihitung Senin', () => {
    expect(slaDueAt(wib('2026-10-24T09:00:00'), 24)).toEqual(wib('2026-10-27T00:00:00'));
  });

  it('batas hari dipakai batas WIB, bukan UTC', () => {
    // Sabtu 02:00 WIB masih Jumat 19:00 UTC. Yang menentukan hari WIB-nya.
    expect(slaDueAt(wib('2026-10-24T02:00:00'), 24)).toEqual(wib('2026-10-27T00:00:00'));
  });

  it('jam yang lebih pendek tetap berhenti di hari kerja', () => {
    expect(slaDueAt(wib('2026-10-23T15:00:00'), 4)).toEqual(wib('2026-10-23T19:00:00'));
  });

  it('terlambat dinilai terhadap tenggat, bukan terhadap umur mentah', () => {
    const masuk = wib('2026-10-23T15:00:00'); // Jumat
    expect(isOverdue(masuk, 24, wib('2026-10-25T20:00:00'))).toBe(false); // Minggu malam
    expect(isOverdue(masuk, 24, wib('2026-10-26T16:00:00'))).toBe(true); // Senin sore
  });
});
