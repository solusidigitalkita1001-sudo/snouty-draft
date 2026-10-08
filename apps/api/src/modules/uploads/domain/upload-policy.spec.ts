import { describe, expect, it } from 'vitest';
import { checkUpload, displayName, humanSize, sniffMime } from './upload-policy.js';

const bytes = (...b: number[]) => Uint8Array.from(b);
const text = (s: string) => Uint8Array.from(Buffer.from(s, 'latin1'));
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16);
const WEBP = text('RIFF\x10\x00\x00\x00WEBPVP8 ');

describe('sniffMime — tipe dari isi, bukan nama', () => {
  it('mengenali PDF, PNG, JPG, WEBP; menolak yang lain (HTML, ZIP, EXE)', () => {
    expect(sniffMime(text('%PDF-1.7\n'))).toBe('application/pdf');
    expect(sniffMime(PNG)).toBe('image/png');
    expect(sniffMime(JPG)).toBe('image/jpeg');
    expect(sniffMime(WEBP)).toBe('image/webp');
    expect(sniffMime(text('<html><script>alert(1)</script>'))).toBeNull();
    expect(sniffMime(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull(); // ZIP
    expect(sniffMime(text('MZ\x90\x00'))).toBeNull(); // EXE
    expect(sniffMime(text('RIFF\x10\x00\x00\x00WAVEfmt '))).toBeNull(); // WAV, bukan WEBP
  });
});

describe('checkUpload', () => {
  it('kosong, kebesaran, tipe asing ditolak dengan alasannya', () => {
    expect(checkUpload(new Uint8Array(), 100)).toEqual({ ok: false, reason: 'empty' });
    expect(checkUpload(new Uint8Array(101).fill(0x89), 100)).toEqual({
      ok: false,
      reason: 'too_large',
    });
    expect(checkUpload(text('GIF89a'), 100)).toEqual({ ok: false, reason: 'type_not_allowed' });
    expect(checkUpload(PNG, 100)).toEqual({ ok: true, mime: 'image/png' });
  });

  it('PDF dengan JavaScript, peluncuran program, atau berkas tersemat ditolak; PDF biasa diterima', () => {
    const plain = text('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n%%EOF');
    expect(checkUpload(plain, 10_000)).toEqual({ ok: true, mime: 'application/pdf' });
    for (const active of [
      '/JavaScript (app.alert(1))',
      '/JS (x)',
      '/Launch << /F (cmd.exe) >>',
      '/EmbeddedFile',
    ]) {
      expect(checkUpload(text(`%PDF-1.4\n<< ${active} >>`), 10_000)).toEqual({
        ok: false,
        reason: 'active_content',
      });
    }
  });
});

describe('displayName & humanSize', () => {
  it('path, karakter kontrol, dan pemisah dibuang; nama kosong jadi "denah"; nama panjang dipendekkan', () => {
    expect(displayName('C:\\Users\\a\\denah rumah.pdf')).toBe('denah rumah.pdf');
    expect(displayName('../../etc/passwd')).toBe('passwd');
    expect(displayName('a"b<c>\r\n.png')).toBe('abc.png');
    expect(displayName('   ')).toBe('denah');
    expect(displayName(`${'x'.repeat(200)}.pdf`).length).toBeLessThanOrEqual(120);
  });

  it('ukuran dalam KB/MB, desimal koma untuk Indonesia', () => {
    expect(humanSize(850 * 1024)).toBe('850 KB');
    expect(humanSize(2.4 * 1024 * 1024)).toBe('2,4 MB');
    expect(humanSize(2.4 * 1024 * 1024, 'en')).toBe('2.4 MB');
  });
});
