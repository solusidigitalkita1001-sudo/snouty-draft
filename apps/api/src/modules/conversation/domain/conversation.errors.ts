/** Galat domain percakapan. */

export class ConversationNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;

  constructor(readonly conversationId: string) {
    super('Percakapan tidak ditemukan.');
    this.name = 'ConversationNotFoundError';
  }
}

export class EmptyMessageError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(field: 'text' | 'title') {
    super('Ada isian yang belum sesuai.');
    this.name = 'EmptyMessageError';
    this.details = { fields: [field] };
  }
}
