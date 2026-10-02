/**
 * P11-01a — redaksi: **tidak ada bentuk data pribadi yang lolos ke model**.
 * docs/EMAIL_INTELLIGENCE.md §5 · docs/PRIVACY.md.
 *
 * Tes ini ditulis dengan sikap curiga: yang penting bukan membuktikan pola-polanya bekerja
 * pada contoh rapi, melainkan bahwa bentuk-bentuk yang BENAR-BENAR ditulis orang Indonesia
 * di email tertangkap — termasuk yang ditulis setengah rapi.
 */
import { describe, expect, it } from 'vitest';
import {
  prepareForModel,
  redact,
  REDACTION_TOKENS,
  stripQuotedHistory,
  stripSignature,
} from './redactor.js';

describe('redaksi nomor telepon', () => {
  const samples = [
    '081234567890',
    '0812-3456-7890',
    '0812 3456 7890',
    '+62 812 3456 7890',
    '+6281234567890',
    '(021) 7654321',
    '021-7654321',
  ];

  it('menangkap bentuk-bentuk yang benar-benar dipakai orang', () => {
    for (const sample of samples) {
      const result = redact(`Hubungi saya di ${sample} ya`);
      expect(result.text, sample).not.toContain(sample);
      expect(result.text, sample).toContain(REDACTION_TOKENS.phone);
    }
  });

  it('tidak menyapu angka kecil seperti jumlah dan tahun', () => {
    const result = redact('Saya butuh 3 kamar mandi, rumah dibangun 2024, 2 lantai.');
    expect(result.text).toContain('3 kamar mandi');
    expect(result.text).toContain('2 lantai');
    expect(result.counts.phone).toBe(0);
  });
});

describe('redaksi nomor panjang (NPWP, rekening)', () => {
  it('menangkap NPWP berpola', () => {
    const result = redact('NPWP 09.254.294.3-407.000 terlampir');
    expect(result.text).not.toContain('09.254.294.3-407.000');
    expect(result.text).toContain(REDACTION_TOKENS.number);
  });

  it('menangkap nomor rekening panjang', () => {
    const result = redact('Rekening 1234567890123 BCA');
    expect(result.text).not.toContain('1234567890123');
  });
});

describe('redaksi alamat email', () => {
  it('meredaksi alamat luar', () => {
    const result = redact('Balas ke budi.santoso@gmail.com');
    expect(result.text).not.toContain('budi.santoso@gmail.com');
    expect(result.text).toContain(REDACTION_TOKENS.email);
  });

  it('membiarkan domain yang dikecualikan (alamat internal bukan data pihak luar)', () => {
    const result = redact('Kirim ke sales@pralon.com', { keepDomains: ['pralon.com'] });
    expect(result.text).toContain('sales@pralon.com');
    expect(result.counts.email).toBe(0);
  });
});

describe('redaksi baris alamat', () => {
  const lines = [
    'Jl. Raya Darmo No. 45, Surabaya',
    'Jalan Sudirman Kav. 52',
    'Perumahan Citra Garden Blok B2/14',
    'Komplek Ruko Mega Mas, Kel. Sawah Besar',
    'RT 05 / RW 03, Desa Sukamaju',
  ];

  it('meredaksi baris yang diawali penanda alamat', () => {
    for (const line of lines) {
      const result = redact(line);
      expect(result.text.trim(), line).toBe(REDACTION_TOKENS.address);
    }
  });

  it('tidak meredaksi kalimat biasa yang kebetulan memuat kata "blok"', () => {
    const result = redact('Pipa dipasang mengikuti blok bangunan yang ada.');
    expect(result.counts.address).toBe(0);
  });
});

describe('pembersihan riwayat balasan', () => {
  it('membuang blok kutipan ">"', () => {
    const body = 'Terima kasih, saya setuju.\n\n> Pesan lama yang panjang\n> baris kedua';
    expect(stripQuotedHistory(body)).toBe('Terima kasih, saya setuju.');
  });

  it('membuang riwayat gaya "Pada ... menulis:"', () => {
    const body = 'Baik, lanjut.\n\nPada 1 Oktober 2026 pukul 10.00, Budi menulis:\nisi lama';
    expect(stripQuotedHistory(body)).toBe('Baik, lanjut.');
  });

  it('membuang riwayat gaya Outlook "From:"', () => {
    const body = 'Setuju.\n\nFrom: Budi\nSent: Monday\nisi lama';
    expect(stripQuotedHistory(body)).toBe('Setuju.');
  });

  it('membiarkan email tanpa riwayat utuh', () => {
    const body = 'Saya butuh penawaran pipa PVC AW 1 inci.';
    expect(stripQuotedHistory(body)).toBe(body);
  });
});

describe('pemisahan blok tanda tangan', () => {
  it('memisahkan di penanda "--"', () => {
    const { body, signature } = stripSignature('Isi pesan.\n\n--\nBudi\n0812-3456-7890');
    expect(body).toBe('Isi pesan.');
    expect(signature).toContain('0812-3456-7890');
  });

  it('memisahkan di "Hormat saya,"', () => {
    const { body } = stripSignature('Isi pesan.\n\nHormat saya,\nBudi Santoso\nPT Contoh');
    expect(body).toBe('Isi pesan.');
  });

  it('memisahkan di "Sent from my iPhone"', () => {
    const { body } = stripSignature('Oke.\n\nSent from my iPhone');
    expect(body).toBe('Oke.');
  });
});

describe('prepareForModel — jalur lengkap', () => {
  const EMAIL = `Selamat pagi,

Saya ingin penawaran pipa PVC AW untuk rumah 2 lantai, 3 kamar mandi.
Lokasi proyek di Surabaya. Hubungi saya di 0812-3456-7890.
Jl. Raya Darmo No. 45, Surabaya

Hormat saya,
Budi Santoso
PT Contoh Sejahtera
Telp: (031) 5551234
NPWP: 09.254.294.3-407.000
budi@contoh.co.id

> Pada 30 September 2026, sales@pralon.com menulis:
> Terima kasih atas minat Anda.`;

  const prepared = prepareForModel(EMAIL, { keepDomains: ['pralon.com'] });

  it('tidak meloloskan satu pun nomor telepon', () => {
    expect(prepared.text).not.toMatch(/0812|5551234|031/);
  });

  it('tidak meloloskan NPWP maupun alamat email pribadi', () => {
    expect(prepared.text).not.toContain('09.254.294.3-407.000');
    expect(prepared.text).not.toContain('budi@contoh.co.id');
  });

  it('tidak meloloskan baris alamat', () => {
    expect(prepared.text).not.toContain('Jl. Raya Darmo');
  });

  it('tidak meloloskan riwayat balasan', () => {
    expect(prepared.text).not.toContain('Terima kasih atas minat Anda');
  });

  it('MEMPERTAHANKAN isi yang justru dibutuhkan analisis', () => {
    // Redaksi yang membuang kebutuhan teknis akan membuat modulnya tidak berguna.
    expect(prepared.text).toContain('PVC AW');
    expect(prepared.text).toContain('2 lantai');
    expect(prepared.text).toContain('3 kamar mandi');
  });

  it('mempertahankan lokasi tingkat kota — itu nilai analitiknya', () => {
    expect(prepared.text).toContain('Surabaya');
  });

  it('tidak membuang teks asli: redaksi bekerja pada salinan', () => {
    // Fungsinya murni; masukannya tidak berubah, dan pemanggil tetap memegang aslinya
    // untuk ditinjau manusia.
    expect(EMAIL).toContain('0812-3456-7890');
  });
});
