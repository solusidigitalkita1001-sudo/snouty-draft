/**
 * Redaksi data pribadi sebelum teks email dikirim ke model.
 * docs/EMAIL_INTELLIGENCE.md §5 · docs/PRIVACY.md. **Fungsi murni, tanpa I/O.**
 *
 * Ini jalur paparan data pribadi terbesar di seluruh sistem, dan berbeda dari chat dalam
 * satu hal yang menentukan: **pengirim email tidak pernah menyetujui isinya diproses
 * model pihak ketiga.** Pengguna chat setuju saat memakai produknya; orang yang mengirim
 * email ke `sales@pralon.com` tidak pernah diminta.
 *
 * Karena itu redaksi berjalan **sebelum** teks menyentuh LLM, bukan sesudahnya. Teks asli
 * tetap utuh di MySQL untuk ditinjau manusia — yang diredaksi hanyalah salinan yang
 * dikirim ke model.
 *
 * Pendekatannya sengaja **berlebihan, bukan presisi**: lebih baik meredaksi nomor yang
 * ternyata bukan telepon daripada melewatkan satu yang memang telepon. Konsekuensi salah
 * arah di sini tidak setara.
 */

export const REDACTION_TOKENS = {
  phone: '[TELEPON]',
  address: '[ALAMAT]',
  number: '[NOMOR]',
  email: '[EMAIL]',
} as const;

/** Domain yang tidak diredaksi — alamat internal bukan data pribadi pihak luar. */
export interface RedactOptions {
  readonly keepDomains?: readonly string[];
}

export interface RedactionResult {
  readonly text: string;
  /** Jumlah penggantian per jenis — dicatat sebagai metrik, tanpa nilai aslinya. */
  readonly counts: Readonly<Record<keyof typeof REDACTION_TOKENS, number>>;
}

/**
 * Nomor telepon Indonesia dalam bentuk yang lazim ditulis manusia: `08xx`, `+62`, `(021)`,
 * dengan pemisah spasi/titik/hubung. Delapan digit atau lebih, supaya tahun dan kuantitas
 * tidak ikut tersapu.
 */
const PHONE = /(?:\+?62|\(0\d{2,3}\)|0)[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4}){1,4}\b/g;

/**
 * NPWP (15–16 digit berpola) dan nomor rekening panjang. Diperiksa SETELAH telepon supaya
 * nomor telepon tidak ditandai sebagai nomor rekening.
 */
const LONG_NUMBER =
  /\b\d{2}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d[-\s]?\d{3}[.\s-]?\d{3}\b|\b\d{10,16}\b/g;

/** Alamat email. */
const EMAIL = /\b[\w.+-]+@([\w-]+(?:\.[\w-]+)+)\b/g;

/**
 * Baris alamat: diawali kata kunci alamat Indonesia yang lazim. Sengaja berbasis kata
 * kunci, bukan mencoba memahami alamat — alamat Indonesia terlalu beragam untuk itu, dan
 * pola yang mencoba cerdas akan melewatkan lebih banyak daripada yang ditangkapnya.
 */
const ADDRESS_LINE =
  /^[ \t]*(?:jl\.?|jalan|gg\.?|gang|perum(?:ahan)?|komp(?:lek|leks)?\.?|ruko|blok|rt[\s./]*\d+|rw[\s./]*\d+|kel\.?|kelurahan|kec\.?|kecamatan|desa|dusun|kav\.?)\b.*$/gim;

/**
 * Pemisah blok tanda tangan yang lazim. Segala sesudahnya dibuang: di situlah sebagian
 * besar data pribadi berada, dan membuangnya membuat redaksi jauh lebih andal.
 */
const SIGNATURE_SEPARATORS = [
  /^--\s*$/m,
  /^__+\s*$/m,
  /^(?:salam|hormat saya|regards|best regards|terima kasih),?\s*$/im,
  /^sent from my /im,
  /^dikirim dari /im,
];

/** Penanda awal riwayat balasan — teks sesudahnya adalah pesan lama. */
const QUOTE_MARKERS = [
  /^>.*$/m,
  /^pada .{0,80}menulis:\s*$/im,
  /^on .{0,80}wrote:\s*$/im,
  /^from:.*$/im,
  /^-{2,}\s*forwarded message\s*-{2,}$/im,
  /^-{2,}\s*pesan diteruskan\s*-{2,}$/im,
];

/**
 * Membuang riwayat balasan. Tanpa ini, balasan kesepuluh dalam satu rantai mengirim
 * seluruh riwayat ke model — mahal, dan membuat analisis tertuju pada pesan lama alih-alih
 * yang baru (docs/EMAIL_INTELLIGENCE.md §3).
 */
export function stripQuotedHistory(body: string): string {
  let earliest = body.length;
  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(body);
    if (match?.index !== undefined && match.index < earliest) earliest = match.index;
  }
  return body.slice(0, earliest).trimEnd();
}

/** Memisahkan blok tanda tangan. Bagian yang dibuang tidak pernah dikirim ke model. */
export function stripSignature(body: string): { body: string; signature: string } {
  let earliest = body.length;
  for (const separator of SIGNATURE_SEPARATORS) {
    const match = separator.exec(body);
    if (match?.index !== undefined && match.index < earliest) earliest = match.index;
  }
  return {
    body: body.slice(0, earliest).trimEnd(),
    signature: body.slice(earliest).trim(),
  };
}

/**
 * Meredaksi data pribadi. Urutannya penting: email lebih dulu (ia memuat `@` dan angka),
 * lalu telepon, lalu nomor panjang, terakhir baris alamat.
 */
export function redact(text: string, options: RedactOptions = {}): RedactionResult {
  const keep = new Set((options.keepDomains ?? []).map((domain) => domain.toLowerCase()));
  const counts = { phone: 0, address: 0, number: 0, email: 0 };

  let result = text.replace(EMAIL, (match, domain: string) => {
    if (keep.has(domain.toLowerCase())) return match;
    counts.email += 1;
    return REDACTION_TOKENS.email;
  });

  result = result.replace(PHONE, () => {
    counts.phone += 1;
    return REDACTION_TOKENS.phone;
  });

  result = result.replace(LONG_NUMBER, () => {
    counts.number += 1;
    return REDACTION_TOKENS.number;
  });

  result = result.replace(ADDRESS_LINE, () => {
    counts.address += 1;
    return REDACTION_TOKENS.address;
  });

  return { text: result, counts };
}

/**
 * Menyiapkan badan email untuk dikirim ke model: buang riwayat, pisahkan tanda tangan,
 * lalu redaksi. Satu fungsi supaya tidak ada pemanggil yang melakukan dua dari tiga.
 */
export function prepareForModel(body: string, options: RedactOptions = {}): RedactionResult {
  const withoutHistory = stripQuotedHistory(body);
  const { body: withoutSignature } = stripSignature(withoutHistory);
  return redact(withoutSignature, options);
}
