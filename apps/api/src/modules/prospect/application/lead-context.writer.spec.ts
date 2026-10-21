/** P26-06 — paragraf konteks: model merangkai, kode memeriksa; gagal pagar = tanpa paragraf. */
import { describe, expect, it, vi } from 'vitest';
import type { LeadFacts } from '../domain/lead.js';
import { LeadContextWriter, leadFactsText } from './lead-context.writer.js';

const FACTS: LeadFacts = {
  projects: [
    {
      conversationId: 'C1',
      title: 'Rumah 2 lantai',
      updatedAt: new Date('2026-10-20T00:00:00Z'),
      buildingType: 'residential',
      floors: 2,
      bathrooms: 3,
      waterSource: 'rooftop_tank',
      caseId: null,
      headline: 'Sistem distribusi untuk 9 titik air',
      mainSize: '1"',
      products: [{ name: 'Pipa AW 1" x 4 Meter', family: 'PVC AW', size: '1"' }],
    },
  ],
  reports: 1,
  shares: 0,
  salesRequest: { source: 'price', at: new Date('2026-10-20T00:00:00Z') },
  quotes: [{ text: 'harga pipa AW 1 inch berapa?', at: new Date('2026-10-20T00:00:00Z') }],
};

const aiReturning = (raw: unknown) => ({ writeProse: vi.fn(async () => raw) });

describe('LeadContextWriter (P26-06)', () => {
  it('DATA disusun kode dari baris terstruktur, kutipan ditandai sebagai kutipan', () => {
    const data = leadFactsText(FACTS);
    expect(data).toContain('lantai: 2');
    expect(data).toContain('hasil hitungan: Sistem distribusi untuk 9 titik air');
    expect(data).toContain('kutipan pelanggan: "harga pipa AW 1 inch berapa?"');
  });

  it('paragraf yang angkanya ada di DATA dipakai', async () => {
    const text =
      'Pelanggan sedang membangun rumah 2 lantai dengan 3 kamar mandi dan sudah membuat laporan. Ia menanyakan harga, jadi tawarkan penawaran untuk pipa utamanya.';
    const writer = new LeadContextWriter(aiReturning({ text }));
    expect(await writer.write(FACTS)).toBe(text);
  });

  it('paragraf yang menyapa pelanggan (bukan catatan untuk sales) → tanpa paragraf', async () => {
    const writer = new LeadContextWriter(
      aiReturning({
        text: 'Pak, untuk rumah 2 lantai itu, kapan Bapak mau mulai memasang pipanya?',
      }),
    );
    expect(await writer.write(FACTS)).toBeNull();
  });

  it('angka yang tidak ada di DATA → tanpa paragraf', async () => {
    const writer = new LeadContextWriter(
      aiReturning({ text: 'Pelanggan butuh sekitar 45 batang pipa untuk rumah 2 lantai.' }),
    );
    expect(await writer.write(FACTS)).toBeNull();
  });

  it('bentuk salah, model gagal, atau tanpa model → tanpa paragraf', async () => {
    expect(await new LeadContextWriter(aiReturning('teks lepas')).write(FACTS)).toBeNull();
    const failing = {
      writeProse: vi.fn(async () => {
        throw new Error('timeout');
      }),
    };
    expect(await new LeadContextWriter(failing).write(FACTS)).toBeNull();
    expect(await new LeadContextWriter(null).write(FACTS)).toBeNull();
  });

  it('tanpa konsultasi maupun kutipan, model tidak dipanggil', async () => {
    const ai = aiReturning({ text: 'x' });
    const empty: LeadFacts = {
      projects: [],
      reports: 0,
      shares: 0,
      salesRequest: null,
      quotes: [],
    };
    expect(await new LeadContextWriter(ai).write(empty)).toBeNull();
    expect(ai.writeProse).not.toHaveBeenCalled();
  });
});
