/**
 * Port pemberitahuan (P27-07, pemilik 2026-10-23: "notifikasi belum ada").
 *
 * Modul yang MENGHASILKAN kejadian (prospek, laporan) tidak boleh bergantung pada modul
 * notifikasi: ia bergantung pada antarmuka ini saja. Dengan begitu notifikasi bisa diganti
 * (surel, push) tanpa menyentuh satu pun pemanggilnya, dan pagar arah dependensi tetap utuh
 * (docs/ARCHITECTURE.md §7).
 *
 * Yang dikirim adalah KEJADIAN, bukan kalimat. Kalimatnya dirakit di lapisan tampilan per bahasa;
 * teks Indonesia yang dibekukan di database tidak bisa berbahasa Inggris nanti.
 */

export const NOTIFIER = Symbol('NOTIFIER');

export type NotificationKind =
  | 'lead_assigned'
  | 'contact_requested'
  | 'report_ready'
  | 'follow_up_due';

export interface NotificationEvent {
  /** Akun yang diberi tahu. Tamu tidak punya tempat untuk menerimanya. */
  readonly userId: string;
  readonly kind: NotificationKind;
  /** Yang dirujuk: pengguna prospek, permintaan dihubungi, atau laporan. */
  readonly subjectId?: string | undefined;
  /** Secukupnya untuk merangkai kalimatnya tanpa membaca tabel lain. */
  readonly data?: Readonly<Record<string, string | number | null>> | undefined;
}

export interface Notifier {
  /**
   * Mencatat pemberitahuan. Tidak pernah menggagalkan pemanggilnya: penugasan prospek yang
   * berhasil tidak boleh dibatalkan hanya karena baris pemberitahuannya gagal ditulis.
   */
  notify(event: NotificationEvent): Promise<void>;
  /** Satu kejadian untuk beberapa penerima (mis. semua admin). */
  notifyAll(userIds: readonly string[], event: Omit<NotificationEvent, 'userId'>): Promise<void>;
}
