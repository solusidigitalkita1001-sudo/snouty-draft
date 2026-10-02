/** Galat domain AI — kode stabil, tanpa stack trace ke klien. */
export class AiOutputInvalidError extends Error {
  constructor(
    readonly task: string,
    readonly detail: string,
  ) {
    super(`keluaran AI untuk '${task}' tidak valid setelah satu percobaan ulang`);
    this.name = 'AiOutputInvalidError';
  }
}
