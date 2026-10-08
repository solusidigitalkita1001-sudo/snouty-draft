/**
 * Register-gate & resume (P8-09, OQ-27 usulan default): tamu yang menekan aksi khusus akun
 * dibawa ke daftar/masuk dengan alamat percakapannya, lalu kembali ke percakapan yang SAMA dan
 * aksinya diteruskan — tanpa mengetik ulang. Penautan datanya sendiri sudah dikerjakan server
 * (invarian G-1); modul ini hanya merangkai dan membaca alamatnya.
 *
 * Nilai dari URL adalah masukan pengguna: ID percakapan harus ULID dan aksinya harus dikenal,
 * selain itu diabaikan — supaya tautan buatan tidak bisa mengarahkan ke tempat lain.
 */

/** Aksi yang diteruskan setelah masuk. Hanya yang memang dibuka oleh akun terdaftar. */
export type ResumeAction = 'save';

export interface ResumeTarget {
  readonly conversationId: string;
  readonly then: ResumeAction | null;
}

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const ACTIONS: readonly ResumeAction[] = ['save'];

/** Tautan ke layar daftar/masuk yang membawa percakapan dan aksinya. */
export function gateHref(
  mode: 'register' | 'login',
  conversationId: string,
  then: ResumeAction,
): string {
  const params = new URLSearchParams({ resume: conversationId, then });
  return `/${mode}?${params.toString()}`;
}

/** Membaca `?resume=…&then=…` (layar auth) atau `?c=…&then=…` (layar konsultasi). */
export function parseResume(search: string): ResumeTarget | null {
  const params = new URLSearchParams(search);
  const id = params.get('resume') ?? params.get('c');
  if (id === null || !ULID.test(id)) return null;
  const then = params.get('then');
  return {
    conversationId: id,
    then: ACTIONS.find((a) => a === then) ?? null,
  };
}

/**
 * Tujuan setelah daftar/masuk berhasil. Percakapan yang dipindahkan server lebih dipercaya
 * daripada alamat; aksinya hanya diteruskan bila percakapannya sama dengan yang diminta.
 */
export function afterAuthHref(search: string, resumedConversationId: string | null): string {
  const target = parseResume(search);
  const id = resumedConversationId ?? target?.conversationId ?? null;
  if (id === null || !ULID.test(id)) return '/consultation';
  const params = new URLSearchParams({ c: id });
  if (target?.then && target.conversationId === id) params.set('then', target.then);
  return `/consultation?${params.toString()}`;
}
