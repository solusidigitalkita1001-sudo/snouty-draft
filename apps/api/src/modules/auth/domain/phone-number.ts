/**
 * Nomor HP yang bisa dihubungi tim Pralon (permintaan pemilik 2026-10-12: "pastiin user nyantumin
 * no hp yang bisa di hubungin"). Nomor seluler Indonesia saja — 08…, 628…, atau +628… — dengan
 * spasi, titik, tanda hubung, dan kurung diabaikan. Disimpan dalam satu bentuk (+628…) supaya
 * tim bisa langsung menelepon atau membuka WhatsApp tanpa menebak formatnya.
 *
 * Parser nilai terstruktur atas isian formulir, bukan tebakan atas kalimat.
 */

/** Setelah "+62 8": 7–11 digit — nomor seluler Indonesia 10–13 digit bila ditulis 08…. */
const MOBILE = /^\+628\d{7,11}$/;

/** Bentuk baku "+628…", atau `null` bila bukan nomor seluler Indonesia yang sah. */
export function normalizeIndonesianMobile(raw: string): string | null {
  const compact = raw.trim().replace(/[\s.\-()]/g, '');
  let normalized: string;
  if (compact.startsWith('+62')) normalized = compact;
  else if (compact.startsWith('62')) normalized = `+${compact}`;
  else if (compact.startsWith('0')) normalized = `+62${compact.slice(1)}`;
  else return null;
  return MOBILE.test(normalized) ? normalized : null;
}
