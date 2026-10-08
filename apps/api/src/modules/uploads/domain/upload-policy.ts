/**
 * Kebijakan berkas lampiran denah (docs/SECURITY.md §7) — fungsi murni.
 *
 * Tipe ditentukan dari ISI berkas (magic bytes), bukan dari nama atau `Content-Type` kiriman
 * browser: keduanya dikendalikan pengirim. Tanpa pemindai antivirus, tipe dibatasi ketat, dan
 * PDF yang memuat aksi aktif (JavaScript, peluncuran program, berkas tersemat) ditolak — denah
 * tidak pernah membutuhkannya.
 */

export const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export type UploadRejection = 'empty' | 'too_large' | 'type_not_allowed' | 'active_content';

export type UploadVerdict =
  | { readonly ok: true; readonly mime: AllowedMime }
  | { readonly ok: false; readonly reason: UploadRejection };

/** Tipe dari magic bytes; `null` bila bukan salah satu tipe yang diizinkan. */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf'; // %PDF-
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  // RIFF....WEBP
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes.length >= 12) {
    const tag = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (tag === 'WEBP') return 'image/webp';
  }
  return null;
}

/** Penanda aksi aktif di PDF. Dicari di byte mentah (latin1) — nama kunci PDF selalu ASCII. */
const PDF_ACTIVE =
  /\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction\s*<<[^>]*\/S\s*\/JavaScript)\b/;

export function checkUpload(bytes: Uint8Array, maxBytes: number): UploadVerdict {
  if (bytes.length === 0) return { ok: false, reason: 'empty' };
  if (bytes.length > maxBytes) return { ok: false, reason: 'too_large' };
  const mime = sniffMime(bytes);
  if (mime === null) return { ok: false, reason: 'type_not_allowed' };
  if (mime === 'application/pdf' && PDF_ACTIVE.test(Buffer.from(bytes).toString('latin1'))) {
    return { ok: false, reason: 'active_content' };
  }
  return { ok: true, mime };
}

/**
 * Nama asli hanya metadata dan tampilan: path dibuang, karakter kontrol dan pemisah disaring,
 * panjang dibatasi. Tidak pernah dipakai sebagai nama berkas di disk.
 */
export function displayName(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    // Karakter kontrol SENGAJA dicari: nama berkas dari pengguna bisa memuatnya (header injection).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const name = cleaned === '' ? 'denah' : cleaned;
  return name.length > 120 ? `${name.slice(0, 100)}…${name.slice(-19)}` : name;
}

/** Ukuran untuk dibaca manusia: "850 KB", "2,4 MB". */
export function humanSize(bytes: number, locale: 'id' | 'en' = 'id'): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `${locale === 'id' ? mb.replace('.', ',') : mb} MB`;
}
