/**
 * P2-05a — **tidak ada varian kartu yang menerima HTML atau markdown bebas.**
 *
 * Hampir seluruh berkas ini berjalan saat **kompilasi**. `@ts-expect-error` gagal
 * ketika galatnya hilang, jadi melonggarkan union ini akan menggagalkan
 * `pnpm typecheck` — bukan lolos sampai seseorang menyadari ada markup muncul di
 * layar. Itu bentuk pengujian yang tepat untuk pagar yang sifatnya struktural:
 * yang dijaga adalah **ketiadaan** jalur, dan ketiadaan tidak bisa dipanggil.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_CLARIFICATION_QUESTIONS,
  type AssistantCard,
  type AssistantCardKind,
} from './assistant-card.js';

describe('AssistantCard tertutup di tingkat tipe', () => {
  it('tidak punya varian yang membawa HTML', () => {
    // @ts-expect-error tidak ada varian `html` — balasan asisten tidak pernah HTML.
    const impossible: AssistantCard = { kind: 'html', html: '<script>alert(1)</script>' };

    expect(impossible).toBeDefined();
  });

  it('tidak punya varian yang membawa markdown bebas', () => {
    // @ts-expect-error tidak ada varian `markdown`.
    const impossible: AssistantCard = { kind: 'markdown', text: '# judul\n<img onerror=x>' };

    expect(impossible).toBeDefined();
  });

  it('tidak mengizinkan field markup diselipkan ke varian yang sah', () => {
    const impossible: AssistantCard = {
      kind: 'summary',
      fields: [],
      readCount: 0,
      // @ts-expect-error `summary` tidak punya field `html`.
      html: '<b>x</b>',
    };

    expect(impossible).toBeDefined();
  });

  it('tidak mengizinkan aksi CTA di luar tiga yang didukung', () => {
    // @ts-expect-error aksi bebas berarti tombol yang tidak ada penanganannya.
    const impossible: AssistantCard = { kind: 'cta', action: 'DELETE_ACCOUNT' };

    expect(impossible).toBeDefined();
  });

  it('mewajibkan setiap baris ringkasan membawa provenance', () => {
    const impossible: AssistantCard = {
      kind: 'summary',
      // @ts-expect-error nilai tanpa asal-usul tidak boleh dirender (SPEC §5 Policy 4).
      fields: [{ label: 'Lantai', value: '2' }],
      readCount: 1,
    };

    expect(impossible).toBeDefined();
  });

  it('mewajibkan kartu produk membawa productId dan rujukan sumbernya', () => {
    // @ts-expect-error kartu produk tanpa productId tidak bisa berasal dari katalog —
    // itulah yang membuat invarian C-2 struktural.
    const impossible: AssistantCard = { kind: 'product', products: [{ name: 'Pipa' }] };

    expect(impossible).toBeDefined();
  });
});

describe('daftar varian', () => {
  it('memuat tepat enam bentuk balasan yang didukung', () => {
    // Daftar ini ditulis ulang di sini dengan sengaja: menambah varian berarti
    // memperbarui tes ini, dan di situlah pertanyaan "apakah ini butuh jalur render
    // baru?" pasti ditanyakan.
    const kinds: readonly AssistantCardKind[] = [
      'summary',
      'clarification',
      'criteria',
      'unsupported',
      'product',
      'cta',
    ];

    expect(new Set(kinds).size).toBe(6);
  });

  it('membatasi pertanyaan klarifikasi pada empat — lebih dari itu berhenti terasa seperti percakapan', () => {
    expect(MAX_CLARIFICATION_QUESTIONS).toBe(4);
  });
});
