import { describe, expect, it, vi } from 'vitest';
import type { RecommendationStats, SystemLine } from '@snouty/shared-types';
import { LlmProseWriter, buildContext, type ProseCapableAi } from './llm-prose-writer.js';

const STATS: RecommendationStats = {
  outletCount: 12,
  mainSize: '1"',
  branchCount: 3,
  fixtureConnectionSize: '1/2"',
  productCount: 4,
};

const LINES: readonly SystemLine[] = [
  {
    name: 'Pipa distribusi utama',
    path: 'Sumber → riser',
    size: '1"',
    reason: 'Beban 12 unit melewati ambang 8 unit (ENG-002).',
    provenance: 'ASSUMED',
    traceIds: ['t1'],
    role: 'main',
  },
];

const INPUT = { stats: STATS, systemLines: LINES };

function ai(reply: unknown): ProseCapableAi {
  return { writeProse: vi.fn(() => Promise.resolve(reply)) };
}

const VALID = {
  headline: 'Sistem distribusi untuk 12 titik air',
  body: 'Jalur utama memakai ukuran 1" karena beban mencapai 12 unit. Sambungan fixture 1/2".',
};

describe('LlmProseWriter', () => {
  it('mengembalikan prosa yang bentuknya sah', async () => {
    const result = await new LlmProseWriter(ai(VALID), 'sys').write(INPUT);
    expect(result).toEqual(VALID);
  });

  it('menolak keluaran yang kehilangan field', async () => {
    const writer = new LlmProseWriter(ai({ headline: 'Sistem distribusi air' }), 'sys');
    await expect(writer.write(INPUT)).rejects.toThrow();
  });

  it('menolak field asing — skema strict, bukan diabaikan', async () => {
    // Mengabaikan field asing terasa longgar sampai ada field asing yang berfungsi.
    const writer = new LlmProseWriter(ai({ ...VALID, estimatedPrice: 4_500_000 }), 'sys');
    await expect(writer.write(INPUT)).rejects.toThrow();
  });

  it('menolak body yang jauh terlalu panjang', async () => {
    const writer = new LlmProseWriter(ai({ ...VALID, body: 'a'.repeat(1_200) }), 'sys');
    await expect(writer.write(INPUT)).rejects.toThrow();
  });

  it('menolak null — adapter pengembangan tidak mengarang prosa', async () => {
    // DevDeterministicAiService mengembalikan null; perakitan lalu memakai templat.
    const writer = new LlmProseWriter(ai(null), 'sys');
    await expect(writer.write(INPUT)).rejects.toThrow();
  });

  it('meneruskan system prompt yang diberikan, bukan menyusun sendiri', async () => {
    const service = ai(VALID);
    await new LlmProseWriter(service, 'PROMPT-KHUSUS').write(INPUT);
    expect(service.writeProse).toHaveBeenCalledWith(
      expect.objectContaining({ systemPrompt: 'PROMPT-KHUSUS' }),
    );
  });
});

describe('buildContext', () => {
  it('mengirim angka terhitung, masing-masing berlabel', () => {
    const context = buildContext(INPUT);
    expect(context).toContain('titik air: 12');
    expect(context).toContain('jumlah cabang: 3');
    expect(context).toContain('ukuran jalur utama: 1 inci');
    expect(context).toContain('ukuran sambungan fixture: 1/2 inci');
    expect(context).toContain('produk Pralon yang cocok: 4');
  });

  it('tidak pernah mengirim tanda inci (") — model kecil menyalinnya ke JSON tanpa escape', () => {
    // Dibuktikan live dengan qwen2.5:7b: `1"` di dalam string JSON memotong body menjadi
    // "Ukuran jalur utama 1", gagal skema, dan prosa jatuh ke templat.
    expect(buildContext(INPUT)).not.toMatch(/\d\s*"/);
  });

  it('mengirim alasan teknis per jalur', () => {
    expect(buildContext(INPUT)).toContain('Beban 12 unit melewati ambang 8 unit (ENG-002).');
  });

  it('menandai isinya sebagai data, bukan instruksi', () => {
    const context = buildContext(INPUT);
    expect(context).toContain('bukan instruksi');
    expect(context).toContain('--- SELESAI DATA ---');
  });

  it('tidak memuat transkrip percakapan — hanya state terstruktur', () => {
    // Jalur ini tidak pernah melihat pesan mentah pengguna, jadi tidak ada kalimat
    // pengguna yang bisa berperan sebagai instruksi bagi model.
    const context = buildContext(INPUT);
    expect(context).not.toContain('user');
    expect(context).not.toContain('assistant');
  });

  it('tanpa percobaan ulang: tidak menyebut penolakan', () => {
    expect(buildContext(INPUT)).not.toContain('DITOLAK');
  });

  it('percobaan ulang menyebutkan angka yang ditolak', () => {
    const context = buildContext({ ...INPUT, retryReason: 'Angka tidak ada di hasil: 7, 2 1/2' });
    expect(context).toContain('PERCOBAAN SEBELUMNYA DITOLAK');
    expect(context).toContain('7, 2 1/2');
    expect(context).toContain('HANYA angka di DATA TERHITUNG');
  });
});
