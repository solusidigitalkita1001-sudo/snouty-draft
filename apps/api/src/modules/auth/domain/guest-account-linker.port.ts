/**
 * Penautan sesi tamu → akun — invarian **G-1**. docs/DOMAIN_MODEL.md §3 ·
 * docs/SECURITY.md §3 · SPEC §4.4.
 *
 * Janjinya harfiah: SEMUA percakapan milik sesi berpindah ke akun tanpa kehilangan
 * satu pun, dalam SATU transaksi. Kegagalan di tengah tidak boleh meninggalkan
 * percakapan tanpa pemilik — dan satu-satunya cara menjamin itu adalah penandaan
 * sesi dan perpindahan kepemilikan ter-commit bersama atau tidak sama sekali.
 */

export const GUEST_ACCOUNT_LINKER = Symbol('GUEST_ACCOUNT_LINKER');

export interface LinkResult {
  readonly movedConversations: number;
  /**
   * Percakapan yang terakhir disentuh — `resumedConversationId` pada respons
   * register. Inilah yang membuat register-gate melanjutkan kasus yang SAMA
   * alih-alih membuang konteks.
   */
  readonly resumedConversationId: string | null;
}

export interface GuestAccountLinker {
  /**
   * Idempoten dan tidak pernah menggagalkan registrasi:
   *
   *   - sesi tidak ada / kedaluwarsa → tidak ada yang ditautkan, hasil nol
   *   - sesi sudah tertaut ke user yang SAMA → hasil nol (pengulangan aman)
   *   - sesi sudah tertaut ke user LAIN → hasil nol — cookie yang disalin orang
   *     tidak boleh memindahkan percakapan korban ke akun penyalinnya
   */
  link(guestSessionId: string, userId: string): Promise<LinkResult>;
}
