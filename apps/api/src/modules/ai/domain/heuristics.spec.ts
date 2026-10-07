/**
 * Jalur cepat tanpa model: hanya bentuk yang PASTI yang dipotong. Yang paling penting di sini
 * adalah kasus yang TIDAK boleh dipotong — pesan yang membawa kebutuhan tetap ke model
 * (lalu ke presedensi kebutuhan di `context`).
 */
import { describe, expect, it } from 'vitest';
import { asksAboutCompany, certainIntent, heuristicProductQuestion } from './heuristics.js';

describe('certainIntent', () => {
  it('sapaan utuh, merek pesaing, konsep produk — pasti', () => {
    expect(certainIntent('hai')?.intent).toBe('OUT_OF_SCOPE');
    expect(certainIntent('Selamat pagi, Snouty!')?.intent).toBe('OUT_OF_SCOPE');
    expect(certainIntent('lebih bagus Pralon atau Rucika?')?.intent).toBe('COMPETITOR_QUESTION');
    expect(certainIntent('apa bedanya pvc sama hdpe?')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('apa itu PPR?')?.intent).toBe('PRODUCT_LOOKUP');
    // Irigasi: jalur kebutuhan (OQ-47), tanpa menunggu model 40 detik untuk menebaknya.
    expect(certainIntent('untuk bikin irigasi sawah 1 hektar butuh produk apa?')?.intent).toBe(
      'REQUIREMENT_STATEMENT',
    );
    // Kasus teknis umum (Fase 14): gorong-gorong, drainase, transfer, cluster → kebutuhan.
    expect(certainIntent('mau pasang gorong-gorong melintasi jalan')?.intent).toBe(
      'REQUIREMENT_STATEMENT',
    );
    expect(certainIntent('drainase air hujan komplek 2 hektar')?.intent).toBe(
      'REQUIREMENT_STATEMENT',
    );
    // Merek pesaing tetap menang atas isyarat kasus.
    expect(certainIntent('drainase pakai rucika bagus nggak?')?.intent).toBe('COMPETITOR_QUESTION');
  });

  it('Pralon sebagai PERUSAHAAN (Fase 16) — pasti, tanpa model; produk Pralon tetap produk', () => {
    // TEST A: "pralon itu apa?" tidak dipaksa jadi pencarian produk.
    expect(certainIntent('pralon itu apa?')?.intent).toBe('COMPANY_QUESTION');
    expect(certainIntent('Apa itu Pralon')?.intent).toBe('COMPANY_QUESTION');
    expect(certainIntent('what is pralon?')?.intent).toBe('COMPANY_QUESTION');
    // TEST B
    expect(certainIntent('PT Pralon yang gw maksud')?.intent).toBe('COMPANY_QUESTION');
    expect(certainIntent('gw pengen tau terkait company profile PT Pralon')?.intent).toBe(
      'COMPANY_QUESTION',
    );
    expect(certainIntent('pabrik pralon di mana?')?.intent).toBe('COMPANY_QUESTION');
    expect(certainIntent('sejarah pralon gimana?')?.intent).toBe('COMPANY_QUESTION');
    // TEST G: produk tertentu → jalur produk.
    expect(certainIntent('PVC AW Pralon itu apa?')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('produk HDPE nya gimana?')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('Pralon punya HDPE?')?.intent).toBe('PRODUCT_LOOKUP');
    // Kebutuhan yang menyebut perusahaan tetap kebutuhan.
    expect(certainIntent('rumah 2 lantai mau pakai pralon, perusahaan mana?')?.intent).not.toBe(
      'COMPANY_QUESTION',
    );
    expect(asksAboutCompany('produk PVC AW Pralon')).toBe(false);
  });

  it('tidak pasti → null: kebutuhan, rekomendasi, pertanyaan ukuran, kalimat bebas', () => {
    expect(certainIntent('lebih bagus PVC atau HDPE buat rumah 2 lantai?')).toBeNull();
    expect(certainIntent('rumah 2 lantai 3 kamar mandi')).toBeNull();
    // Pertanyaan ukuran produk kini pasti PRODUCT_LOOKUP (P16-08): aspeknya dipetakan terpisah.
    expect(certainIntent('ada ukuran 3/4 untuk PVC AW?')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('hai, saya mau bangun rumah 2 lantai')).toBeNull();
    expect(certainIntent('pipa')).toBeNull();
  });

  it('regex global tidak menyisakan lastIndex (pemanggilan berulang konsisten)', () => {
    expect(certainIntent('apa bedanya pvc dan hdpe')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('apa bedanya pvc dan hdpe')?.intent).toBe('PRODUCT_LOOKUP');
  });
});

describe('heuristicProductQuestion', () => {
  it('produksi 2026-10-07: "cara nyambung pipa pvc pakai lem" bukan aspek joint_type (pengetahuan, aspek null); "harganya berapa?" pasti PRODUCT_LOOKUP', () => {
    expect(heuristicProductQuestion('cara nyambung pipa pvc pakai lem gimana?')).toEqual({
      productQuery: 'pvc',
      aspect: null,
      size: null,
    });
    expect(heuristicProductQuestion('how do I join pvc pipe?').aspect).toBeNull();
    // Pertanyaan sifat sambungan yang sungguhan tetap beraspek.
    expect(heuristicProductQuestion('sambungan pvc aw pakai apa?').aspect).toBe('joint_type');
    expect(certainIntent('harganya berapa?')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('harga pipa buat rumah 2 lantai berapa?')).toBeNull();
  });

  it('pengetahuan pipa (OQ-54): cara sambung/simpan/rawat/istilah tentang pipa → PRODUCT_LOOKUP pasti; dengan kebutuhan → bukan', () => {
    expect(certainIntent('cara nyambung pipa pvc pakai lem gimana?')?.intent).toBe(
      'PRODUCT_LOOKUP',
    );
    expect(certainIntent('pipa pvc disimpan di luar boleh?')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('pipa bocor di sambungan kenapa ya?')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('ukuran hdpe ada apa aja?')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('pipa rumah 2 lantai bocor, gimana?')).toBeNull();
  });

  it('uji proaktif 2026-10-07: "pipa buat air panas pake apa?" pasti PRODUCT_LOOKUP; "ukuran hdpe ada apa aja?" → aspek sizes', () => {
    expect(certainIntent('pipa buat air panas pake apa?')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('bahan apa yang cocok buat pipa tanam?')?.intent).toBe('PRODUCT_LOOKUP');
    // Dengan kebutuhan bangunan tetap kebutuhan.
    expect(certainIntent('rumah 2 lantai pipa pake apa?')).toBeNull();
    expect(heuristicProductQuestion('ukuran hdpe ada apa aja?')).toMatchObject({
      productQuery: 'hdpe',
      aspect: 'sizes',
    });
    expect(heuristicProductQuestion('pvc aw ada ukuran apa?').aspect).toBe('sizes');
  });

  it('en (checkpoint Fase 15, S9): ketersediaan ukuran dan aspek dari kalimat Inggris', () => {
    expect(heuristicProductQuestion('do you have 3/4 inch PVC AW?')).toEqual({
      productQuery: 'pvc aw',
      aspect: 'size_availability',
      size: '3/4',
    });
    expect(heuristicProductQuestion('what sizes does HDPE come in?').aspect).toBe('sizes');
    expect(heuristicProductQuestion('what standard is PVC AW made to?').aspect).toBe('standard');
    expect(heuristicProductQuestion('what pressure class is HDPE PE100?').aspect).toBe(
      'pressure_class',
    );
    expect(heuristicProductQuestion('how long is a PVC AW rod?').aspect).toBe('rod_length');
    expect(heuristicProductQuestion('what joint does HDPE use?').aspect).toBe('joint_type');
    expect(heuristicProductQuestion('PVC D is suitable for which applications?').aspect).toBe(
      'application',
    );
    expect(heuristicProductQuestion('which fittings go with HDPE?').aspect).toBe(
      'compatible_fittings',
    );
  });

  it('pertanyaan konsep tidak pernah menebak aspek: "apa bedanya fitting sama hdpe?" → aspek null', () => {
    expect(heuristicProductQuestion('apa bedanya fitting sama hdpe ?')).toEqual({
      productQuery: 'hdpe',
      aspect: null,
      size: null,
    });
    expect(heuristicProductQuestion('apa itu fitting PVC?').aspect).toBeNull();
    // Pertanyaan spesifikasi sungguhan tetap beraspek.
    expect(heuristicProductQuestion('fitting apa yang cocok untuk pipa HDPE?').aspect).toBe(
      'compatible_fittings',
    );
  });

  it('keluarga + aspek dari bentuk kalimat; ukuran untuk ketersediaan', () => {
    expect(heuristicProductQuestion('ada ukuran 3/4 inch untuk PVC AW?')).toEqual({
      productQuery: 'pvc aw',
      aspect: 'size_availability',
      size: '3/4',
    });
    expect(heuristicProductQuestion('standar SNI pipa PVC AW apa?')).toMatchObject({
      productQuery: 'pvc aw',
      aspect: 'standard',
    });
    expect(heuristicProductQuestion('apa bedanya pvc sama hdpe?')).toEqual({
      productQuery: 'pvc dan hdpe',
      aspect: null,
      size: null,
    });
  });

  it('tanpa keluarga produk → productQuery null (adapter live menyerahkannya ke model); aspek tetap terbaca', () => {
    expect(heuristicProductQuestion('pipa yang bagus buat air panas apa?')).toEqual({
      productQuery: null,
      aspect: null,
      size: null,
    });
    expect(heuristicProductQuestion('ada ukuran 3/4?')).toMatchObject({
      productQuery: null,
      aspect: 'size_availability',
      size: '3/4',
    });
  });
});
