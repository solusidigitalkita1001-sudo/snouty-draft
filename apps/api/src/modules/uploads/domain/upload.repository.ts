import type { AllowedMime } from './upload-policy.js';

export const UPLOAD_REPOSITORY = Symbol('UPLOAD_REPOSITORY');

export interface UploadRow {
  readonly id: string;
  readonly conversationId: string;
  readonly originalName: string;
  readonly mimeType: AllowedMime;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface UploadRepository {
  insert(row: Omit<UploadRow, 'createdAt'>): Promise<void>;
  findById(id: string): Promise<UploadRow | null>;
  listForConversation(conversationId: string): Promise<readonly UploadRow[]>;
  /** Baris yang sudah lewat retensi, paling lama dulu. */
  listExpired(now: Date, limit: number): Promise<readonly UploadRow[]>;
  delete(id: string): Promise<void>;
}
