/**
 * Tautan bagikan baca-saja (P24-03, pemilik 2026-10-19: "bagikan tautan" ke tukang/toko).
 *
 * - Hanya akun pemilik percakapan yang membuat/mencabut tautan; membuat ulang mencabut yang lama.
 * - Token 32 byte acak (base64url) dikirim sekali; yang disimpan hanya SHA-256-nya.
 * - Yang dibagikan: rekomendasi dan skemanya. Percakapan, kebutuhan mentah, dan data akun tidak.
 * - Percakapan dihapus atau tautan dicabut → `NOT_FOUND`, tanpa membedakan keduanya.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Locale, SharedSolution } from '@snouty/shared-types';
import { ulid } from '../../../shared/ulid.js';
import type { RequestActor } from '../../../shared/http/actor.js';
import type { ConversationService } from '../../conversation/application/conversation.service.js';
import type { RequirementSnapshotStore } from '../../context/application/requirement-snapshot.store.js';
import type { RecommendationRepository } from '../domain/recommendation.repository.js';
import type { ShareLinkRepository } from '../domain/share-link.repository.js';
import type { AnalysisService } from './analysis.service.js';

export class ShareNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor() {
    super('Tautan tidak ditemukan atau sudah dicabut.');
    this.name = 'ShareNotFoundError';
  }
}

/** Token mentah → hash yang disimpan. Format token divalidasi lebih dulu oleh pemanggil. */
export function shareTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class ShareService {
  constructor(
    private readonly links: ShareLinkRepository,
    private readonly recommendations: RecommendationRepository,
    private readonly conversations: ConversationService,
    private readonly snapshots: RequirementSnapshotStore,
    private readonly analysis: AnalysisService,
  ) {}

  async create(
    recommendationId: string,
    actor: RequestActor,
  ): Promise<{ token: string; createdAt: string }> {
    const recommendation = await this.ownedRecommendation(recommendationId, actor);
    const token = randomBytes(32).toString('base64url');
    await this.links.replace({
      id: ulid(),
      tokenHash: shareTokenHash(token),
      recommendationId: recommendation.id,
      conversationId: recommendation.conversationId,
      ownerId: actor.id,
    });
    const active = await this.links.activeFor(recommendation.id);
    return { token, createdAt: (active?.createdAt ?? new Date()).toISOString() };
  }

  async status(
    recommendationId: string,
    actor: RequestActor,
  ): Promise<{ active: boolean; createdAt: string | null }> {
    await this.ownedRecommendation(recommendationId, actor);
    const active = await this.links.activeFor(recommendationId);
    return { active: active !== null, createdAt: active?.createdAt.toISOString() ?? null };
  }

  async revoke(recommendationId: string, actor: RequestActor): Promise<void> {
    await this.ownedRecommendation(recommendationId, actor);
    await this.links.revokeFor(recommendationId);
  }

  /** Halaman publik: rekomendasi + skema, tanpa aktor. */
  async resolve(token: string): Promise<SharedSolution> {
    if (!SHARE_TOKEN_PATTERN.test(token)) throw new ShareNotFoundError();
    const link = await this.links.findActiveByHash(shareTokenHash(token));
    if (link === null) throw new ShareNotFoundError();
    const conversation = await this.conversations.findForShare(link.conversationId);
    const recommendation = await this.recommendations.findById(link.recommendationId);
    if (conversation === null || recommendation === null) throw new ShareNotFoundError();
    const snapshot = await this.snapshots.current(link.conversationId);
    const schematic = snapshot
      ? await this.analysis
          .schematicForRecommendation(
            snapshot.state,
            recommendation.catalogVersionId,
            recommendation.createdAt,
            conversation.language as Locale,
          )
          .catch(() => null)
      : null;
    return {
      title: conversation.title,
      sharedAt: link.createdAt.toISOString(),
      recommendation,
      schematic: schematic as SharedSolution['schematic'],
    };
  }

  private async ownedRecommendation(id: string, actor: RequestActor) {
    const recommendation = await this.recommendations.findById(id);
    if (recommendation === null) throw new ShareNotFoundError();
    // Kepemilikan lewat percakapannya; milik orang lain → NOT_FOUND dari ConversationService.
    await this.conversations.find(recommendation.conversationId, actor);
    return recommendation;
  }
}
