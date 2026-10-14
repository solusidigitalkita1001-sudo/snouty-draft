/**
 * SNOUTY berjalan di belakang SATU reverse proxy (nginx). IP klien adalah alamat yang ditambahkan nginx
 * di ujung `X-Forwarded-For`. Tanpa pengaturan ini `request.ip` selalu IP kontainer nginx: rate limit
 * login per IP menjadi satu kuota untuk semua orang dan audit log tidak tahu siapa (audit 2026-10-14).
 * Tepat 1 lompatan, bukan rentang IP privat — alamat buatan klien di sebelah kirinya tidak dipercaya,
 * juga dari jaringan kantor.
 */
export const TRUSTED_PROXY_HOPS = 1;

export function trustReverseProxy(app: { set(setting: string, value: unknown): unknown }): void {
  app.set('trust proxy', TRUSTED_PROXY_HOPS);
}
