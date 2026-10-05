/**
 * Adapter AI khusus pengembangan. Dua hal yang diuji, dan yang pertama lebih penting:
 *
 *   1. **Ia tidak bisa dikonstruksi di luar `development`.** Adapter palsu yang diam-diam
 *      aktif di produksi akan menghasilkan rekomendasi dari regex.
 *   2. Ekstraksinya cukup baik untuk menguji alur dengan tangan, dan keluarannya lolos
 *      skema yang sama seperti keluaran model sungguhan.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExtractionSchema } from '../domain/extraction-schema.js';
import { DevDeterministicAiService } from './dev-deterministic-ai.service.js';

const original = process.env['NODE_ENV'];

beforeEach(() => {
  process.env['NODE_ENV'] = 'development';
});

afterEach(() => {
  if (original === undefined) delete process.env['NODE_ENV'];
  else process.env['NODE_ENV'] = original;
});

describe('pagar lingkungan', () => {
  it('menolak dikonstruksi saat NODE_ENV=production', () => {
    process.env['NODE_ENV'] = 'production';
    expect(() => new DevDeterministicAiService()).toThrow(/development/);
  });

  it('menolak dikonstruksi saat NODE_ENV=test', () => {
    process.env['NODE_ENV'] = 'test';
    expect(() => new DevDeterministicAiService()).toThrow(/development/);
  });

  it('menolak dikonstruksi saat NODE_ENV tidak diset', () => {
    delete process.env['NODE_ENV'];
    expect(() => new DevDeterministicAiService()).toThrow(/development/);
  });
});

describe('ekstraksi', () => {
  const ai = () => new DevDeterministicAiService();

  it('membaca contoh kerja desain', async () => {
    const result = await ai().extract('Rumah 2 lantai, 3 kamar mandi, 4 wastafel, toren di atap');
    expect(result.building?.floors).toBe(2);
    expect(result.building?.type).toBe('residential');
    expect(result.fixtures?.bathrooms).toBe(3);
    expect(result.fixtures?.basins).toBe(4);
    expect(result.water?.source).toBe('rooftop_tank');
  });

  it('membaca kata bilangan, bukan hanya digit', () => {
    return ai()
      .extract('rumah dua lantai dengan tiga kamar mandi')
      .then((r) => {
        expect(r.building?.floors).toBe(2);
        expect(r.fixtures?.bathrooms).toBe(3);
      });
  });

  it('"tidak ada dapur" menjadi 0 eksplisit, bukan tak disebut', async () => {
    // Pembedaan yang sama yang dijaga ContextMerger: 0 adalah jawaban, `undefined` bukan.
    const result = await ai().extract('rumah 1 lantai, tidak ada dapur');
    expect(result.fixtures?.kitchens).toBe(0);
  });

  it('tidak mengarang field yang tidak disebut', async () => {
    const result = await ai().extract('saya mau tanya soal pipa');
    expect(result.building).toBeUndefined();
    expect(result.water).toBeUndefined();
  });

  it('mengenali jenis bangunan selain rumah', async () => {
    expect((await ai().extract('bangun ruko 3 lantai')).building?.type).toBe('light_commercial');
    expect((await ai().extract('pabrik baru')).building?.type).toBe('industrial');
    expect((await ai().extract('rumah kos 2 lantai')).building?.type).toBe('boarding_house');
  });

  it('mengenali pembuangan dan keduanya', async () => {
    expect((await ai().extract('instalasi pembuangan')).water?.installationType).toBe('drainage');
    expect((await ai().extract('air bersih dan pembuangan')).water?.installationType).toBe('both');
  });

  it('keluarannya lolos skema yang sama seperti keluaran model', async () => {
    const result = await ai().extract('rumah 90 lantai, 500 kamar mandi');
    // Nilai di luar batas dijepit sebelum validasi, jadi skema tidak pernah menolaknya.
    expect(() => ExtractionSchema.parse(result)).not.toThrow();
    expect(result.building?.floors).toBe(50);
  });
});

describe('klasifikasi intent', () => {
  const ai = () => new DevDeterministicAiService();

  it('pertanyaan kompetitor dikenali lebih dulu dari apa pun', async () => {
    // Policy 1 harus menang sebelum ekstraksi — termasuk ketika kalimatnya juga memuat
    // kebutuhan ("rumah 2 lantai, Pralon atau Rucika?").
    const result = await ai().classifyIntent({
      message: 'Rumah 2 lantai, lebih bagus Pralon atau Rucika?',
      hasExistingRequirements: false,
    });
    expect(result.intent).toBe('COMPETITOR_QUESTION');
  });

  it('pertanyaan "kenapa" tidak memutasi state', async () => {
    const result = await ai().classifyIntent({
      message: 'kenapa ukurannya 1 inci?',
      hasExistingRequirements: true,
    });
    expect(result.intent).toBe('EXPLANATION_REQUEST');
  });

  it('lookup produk dikenali', async () => {
    const result = await ai().classifyIntent({
      message: 'ada ukuran 3/4 inci?',
      hasExistingRequirements: true,
    });
    expect(result.intent).toBe('PRODUCT_LOOKUP');
  });

  it('"tambah satu kamar mandi" adalah mutasi, bukan pernyataan baru', async () => {
    const result = await ai().classifyIntent({
      message: 'tambah satu kamar mandi',
      hasExistingRequirements: true,
    });
    expect(result.intent).toBe('REQUIREMENT_MUTATION');
  });

  it('pesan pertama adalah pernyataan kebutuhan', async () => {
    const result = await ai().classifyIntent({
      message: 'rumah 2 lantai 3 kamar mandi',
      hasExistingRequirements: false,
    });
    expect(result.intent).toBe('REQUIREMENT_STATEMENT');
  });
});

describe('writeProse di adapter pengembangan', () => {
  it('mengembalikan null — tidak pernah mengarang prosa', async () => {
    // Regex boleh mengisi ekstraksi karena hasilnya langsung terlihat salah bila salah.
    // Prosa karangan terbaca meyakinkan, dan akan menjelaskan angka yang tidak pernah
    // dihitung siapa pun — di layar yang justru dipakai menilai kebenaran produk.
    const saved = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';
    try {
      await expect(new DevDeterministicAiService().writeProse()).resolves.toBeNull();
    } finally {
      process.env['NODE_ENV'] = saved;
    }
  });
});

describe('pertanyaan produk (adapter pengembangan)', () => {
  const service = () => new DevDeterministicAiService();

  it('menyebut keluarga produk tanpa isyarat kebutuhan → PRODUCT_LOOKUP', async () => {
    const intent = await service().classifyIntent({
      message: 'apa bedanya pvc dan hdpe?',
      hasExistingRequirements: false,
    });
    expect(intent.intent).toBe('PRODUCT_LOOKUP');
  });

  it('menyebut produk DI DALAM pernyataan kebutuhan tetap REQUIREMENT_STATEMENT', async () => {
    const intent = await service().classifyIntent({
      message: 'pakai pipa pvc untuk rumah 2 lantai, 3 kamar mandi',
      hasExistingRequirements: false,
    });
    expect(intent.intent).toBe('REQUIREMENT_STATEMENT');
  });

  it('memetakan "A dan B" menjadi satu query dua keluarga, aspek null', async () => {
    const parsed = await service().parseProductQuestion('apa bedanya pvc aw dan hdpe?');
    expect(parsed).toEqual({ productQuery: 'pvc aw dan hdpe', aspect: null, size: null });
  });

  it('memetakan aspek dari kata kunci, dan ukuran hanya untuk ketersediaan', async () => {
    expect(await service().parseProductQuestion('pvc aw ada ukuran 3/4?')).toEqual({
      productQuery: 'pvc aw',
      aspect: 'size_availability',
      size: '3/4',
    });
    expect(await service().parseProductQuestion('standar pvc d apa?')).toMatchObject({
      aspect: 'standard',
      size: null,
    });
    expect(await service().parseProductQuestion('tekanan kerja hdpe berapa?')).toMatchObject({
      productQuery: 'hdpe',
      aspect: 'pressure_class',
    });
  });

  it('tanpa produk yang disebut → productQuery null, bukan tebakan', async () => {
    expect(await service().parseProductQuestion('standarnya apa?')).toMatchObject({
      productQuery: null,
      aspect: 'standard',
    });
  });
});
