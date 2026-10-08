/**
 * UploadsService — "Lampirkan denah" (P13-06, docs/SECURITY.md §7).
 *
 * Apa yang dilakukan sistem dengan denahnya (OQ-56, usulan default): denah DISIMPAN di
 * percakapan dan ikut diteruskan ke tim teknis Pralon saat handoff. Isinya tidak dibaca model —
 * tidak ada pembacaan gambar yang bisa dipertanggungjawabkan di sini — jadi jumlah lantai,
 * kamar mandi, dan sumber air tetap ditanyakan di chat.
 */
import { createHash } from 'node:crypto';
import type { Locale } from '@snouty/shared-types';
import { ulid } from '../../../shared/ulid.js';
import { RateLimitedError } from '../../../shared/http/api-errors.js';
import type { RateLimiter } from '../../../shared/rate-limit/rate-limiter.js';
import type { ConversationService } from '../../conversation/application/conversation.service.js';
import type { ConversationOwner } from '../../conversation/domain/conversation.repository.js';
import { limitFor } from '../../policy/rate-limits.js';
import type { Tier } from '../../policy/entitlements.js';
import {
  checkUpload,
  displayName,
  humanSize,
  type UploadRejection,
} from '../domain/upload-policy.js';
import type { UploadRepository, UploadRow } from '../domain/upload.repository.js';
import type { FileStore } from '../infrastructure/file-store.js';

const DAY_MS = 86_400_000;
const PURGE_BATCH = 100;

export class UploadRejectedError extends Error {
  readonly code = 'UPLOAD_REJECTED' as const;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(
    readonly reason: UploadRejection,
    locale: Locale = 'id',
  ) {
    super(REJECTION_MESSAGE[locale][reason]);
    this.name = 'UploadRejectedError';
    this.details = { reason };
  }
}

export class UploadStorageUnavailableError extends Error {
  readonly code = 'SERVICE_UNAVAILABLE' as const;
  constructor() {
    super('Penyimpanan lampiran belum dikonfigurasi.');
    this.name = 'UploadStorageUnavailableError';
  }
}

export class UploadNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor() {
    super('Lampiran tidak ditemukan.');
    this.name = 'UploadNotFoundError';
  }
}

/** Pesan aman-tampil per alasan penolakan — pengguna tahu apa yang harus diubah. */
const REJECTION_MESSAGE: Readonly<Record<Locale, Readonly<Record<UploadRejection, string>>>> = {
  id: {
    empty: 'Berkasnya kosong. Coba pilih berkas denah lagi.',
    too_large: 'Berkasnya terlalu besar. Kirim denah dalam ukuran lebih kecil.',
    type_not_allowed: 'Denah hanya bisa dikirim sebagai PDF, PNG, JPG, atau WEBP.',
    active_content:
      'PDF ini memuat isi aktif dan tidak bisa diterima. Kirim sebagai gambar atau PDF biasa.',
  },
  en: {
    empty: 'The file is empty. Please choose the floor plan file again.',
    too_large: 'The file is too large. Please send a smaller floor plan.',
    type_not_allowed: 'Floor plans can only be sent as PDF, PNG, JPG, or WEBP.',
    active_content:
      'This PDF contains active content and cannot be accepted. Please send it as an image or a plain PDF.',
  },
};

export interface UploadActor extends ConversationOwner {
  readonly tier: Tier;
}

export interface UploadResult {
  readonly upload: UploadRow;
  /** Gelembung pengguna dan balasan yang sudah tersimpan di percakapan. */
  readonly userText: string;
  readonly replyText: string;
}

export interface UploadsConfig {
  readonly maxBytes: number;
  readonly retentionDays: number;
}

export class UploadsService {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly store: FileStore | null,
    private readonly conversations: Pick<
      ConversationService,
      'find' | 'appendUserMessage' | 'appendAssistantMessage'
    >,
    private readonly rateLimiter: Pick<RateLimiter, 'consume'>,
    private readonly config: UploadsConfig,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async upload(
    conversationId: string,
    actor: UploadActor,
    originalName: string,
    bytes: Uint8Array,
  ): Promise<UploadResult> {
    // Kepemilikan dulu: tamu hanya boleh melampirkan ke percakapannya sendiri.
    const conversation = await this.conversations.find(conversationId, actor);
    if (this.store === null) throw new UploadStorageUnavailableError();

    const locale: Locale = conversation.language === 'en' ? 'en' : 'id';
    const verdict = checkUpload(bytes, this.config.maxBytes);
    if (!verdict.ok) throw new UploadRejectedError(verdict.reason, locale);

    // Kuota dihitung hanya untuk berkas yang lolos — salah pilih berkas tidak menghabiskan jatah.
    const limit = limitFor(actor.tier, 'uploads_per_day');
    if (limit) {
      const quota = await this.rateLimiter.consume('uploads', `${actor.kind}:${actor.id}`, limit);
      if (!quota.allowed) throw new RateLimitedError(quota.retryAfterSec);
    }

    const now = this.clock();
    const row: Omit<UploadRow, 'createdAt'> = {
      id: ulid(),
      conversationId,
      originalName: displayName(originalName),
      mimeType: verdict.mime,
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      expiresAt: new Date(now.getTime() + this.config.retentionDays * DAY_MS),
    };
    await this.store.write(row.id, bytes);
    try {
      await this.uploads.insert(row);
    } catch (error) {
      // Metadata gagal tersimpan: berkas tanpa baris tidak boleh tertinggal di disk.
      await this.store.remove(row.id).catch(() => undefined);
      throw error;
    }

    const userText = attachmentLine(row.originalName, row.sizeBytes, locale);
    const replyText = UPLOAD_REPLY[locale];
    await this.conversations.appendUserMessage(conversationId, actor, userText);
    await this.conversations.appendAssistantMessage(conversationId, replyText, [], null);
    return { upload: { ...row, createdAt: now }, userText, replyText };
  }

  /** Berkas untuk diunduh pemilik percakapannya. */
  async fileFor(
    uploadId: string,
    actor: ConversationOwner,
  ): Promise<{ readonly path: string; readonly row: UploadRow }> {
    const row = await this.uploads.findById(uploadId);
    if (!row || row.expiresAt.getTime() <= this.clock().getTime()) throw new UploadNotFoundError();
    // Melempar NOT_FOUND bila bukan milik aktor — tidak membocorkan keberadaannya.
    await this.conversations.find(row.conversationId, actor);
    if (this.store === null) throw new UploadStorageUnavailableError();
    return { path: this.store.pathOf(row.id), row };
  }

  /** Lampiran percakapan — untuk handoff ke tim teknis. Tanpa pemeriksaan pemilik: pemanggil sudah. */
  async listForConversation(conversationId: string): Promise<readonly UploadRow[]> {
    const now = this.clock().getTime();
    const rows = await this.uploads.listForConversation(conversationId);
    return rows.filter((row) => row.expiresAt.getTime() > now);
  }

  /** Retensi (OQ-13): hapus berkas dan barisnya setelah lewat masa simpan. */
  async purgeExpired(): Promise<number> {
    let removed = 0;
    for (;;) {
      const expired = await this.uploads.listExpired(this.clock(), PURGE_BATCH);
      if (expired.length === 0) return removed;
      for (const row of expired) {
        await this.store?.remove(row.id).catch(() => undefined);
        await this.uploads.delete(row.id);
        removed += 1;
      }
      if (expired.length < PURGE_BATCH) return removed;
    }
  }
}

export function attachmentLine(name: string, sizeBytes: number, locale: Locale): string {
  return locale === 'en'
    ? `Floor plan attached: ${name} (${humanSize(sizeBytes, 'en')})`
    : `Denah terlampir: ${name} (${humanSize(sizeBytes, 'id')})`;
}

/**
 * Balasan atas denah — jujur tentang apa yang terjadi dengannya, tanpa bicara tentang sistem:
 * denah diteruskan ke tim teknis; hitungan tetap butuh data yang ditulis.
 */
const UPLOAD_REPLY: Readonly<Record<Locale, string>> = {
  id: 'Denahnya sudah saya terima dan akan ikut dikirim bila kasus ini diteruskan ke tim teknis Pralon. Supaya hitungannya bisa saya mulai, tuliskan juga jumlah lantai, kamar mandi, dan sumber airnya di sini.',
  en: 'I have received the floor plan, and it will go with this case if it is passed to the Pralon technical team. So I can start the sizing, please also write the number of floors, bathrooms, and the water source here.',
};
