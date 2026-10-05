/**
 * Galat modul `ai`. Dua jenis, dan bedanya penting bagi pemanggil:
 *
 *   - `AiOutputInvalidError`: model MENJAWAB, tetapi keluarannya tidak lolos skema
 *     setelah satu percobaan ulang. Pemanggil jatuh ke klarifikasi/templat.
 *   - `LlmUnavailableError`: model TIDAK terjangkau — kunci ditolak, limit habis,
 *     jaringan putus, 5xx penyedia. Pemanggil memberi tahu pengguna bahwa pemahaman
 *     bahasa sedang tidak tersedia (`LLM_UNAVAILABLE`, retryable), bukan 503 generik.
 */
export class AiOutputInvalidError extends Error {
  constructor(
    readonly task: string,
    readonly detail: string,
  ) {
    super(`keluaran AI untuk '${task}' tidak valid setelah satu percobaan ulang`);
    this.name = 'AiOutputInvalidError';
  }
}

export class LlmUnavailableError extends Error {
  readonly code = 'LLM_UNAVAILABLE' as const;

  /** `status` null untuk kegagalan jaringan — tidak ada respons sama sekali. */
  constructor(readonly status: number | null) {
    super('Model bahasa sedang tidak tersedia. Coba lagi sebentar lagi.');
    this.name = 'LlmUnavailableError';
  }
}
