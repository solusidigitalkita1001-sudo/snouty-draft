/**
 * MessageService — orkestrasi satu giliran chat. docs/CONTEXT_ENGINE.md §3.
 *
 * Mengikat lapisan domain (routing, understanding) ke persistensi dan menghasilkan
 * daftar event SSE untuk dialirkan controller. Persistensi hidup di sini, bukan di
 * pipeline domain, supaya urutan tulis (pesan pengguna → snapshot → pesan asisten)
 * ada di satu tempat.
 *
 * Tanpa AI (kunci tidak diset), giliran tidak jatuh: ia mengalirkan `error`
 * `LLM_UNAVAILABLE` yang retryable — jujur bahwa pemahaman bahasa sedang tak
 * tersedia, sambil tetap membiarkan jalur edit deterministik bekerja.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AssistantStreamEvent } from '@snouty/shared-types';
import { AI_SERVICE, type AiService } from '../../ai/domain/ai.port.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import type { ConversationOwner } from '../../conversation/domain/conversation.repository.js';
import { IntentRouter } from './intent-router.js';
import { runUnderstanding } from './message-pipeline.js';
import { RequirementSnapshotStore } from './requirement-snapshot.store.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { ulid } from '../../../shared/ulid.js';

@Injectable()
export class MessageService {
  constructor(
    private readonly conversations: ConversationService,
    private readonly store: RequirementSnapshotStore,
    private readonly router: IntentRouter,
    @Optional() @Inject(AI_SERVICE) private readonly ai: AiService | null = null,
  ) {}

  /**
   * Memproses satu pesan pengguna dan mengembalikan event untuk dialirkan.
   * `now` disuntikkan demi determinisme pengujian.
   */
  async handle(
    conversationId: string,
    actor: ConversationOwner,
    text: string,
    now: string,
  ): Promise<readonly AssistantStreamEvent[]> {
    // Kepemilikan diperiksa di lapisan application (docs/SECURITY.md §4).
    await this.conversations.find(conversationId, actor);
    await this.conversations.appendUserMessage(conversationId, actor, text);

    const messageId = ulid();

    if (!this.ai) {
      return [
        { type: 'message.start', messageId },
        { type: 'error', code: 'LLM_UNAVAILABLE', retryable: true },
        { type: 'message.end', messageId, usage: { in: 0, out: 0, costUsd: 0 } },
      ];
    }

    const snapshot = await this.store.current(conversationId);
    const state = snapshot?.state ?? emptyRequirementState(now);
    const hasExisting = (snapshot?.state.completeness.filled ?? 0) > 0;

    const decision = await this.router.route(text, hasExisting);
    const result = await runUnderstanding(this.ai, {
      messageId,
      message: text,
      decision,
      state,
      now,
    });

    if (result.changed) {
      await this.store.append(conversationId, result.nextState, result.trigger);
    }

    const cards = result.events
      .filter((e): e is Extract<AssistantStreamEvent, { type: 'card' }> => e.type === 'card')
      .map((e) => e.card);
    await this.conversations.appendAssistantMessage(conversationId, '', cards, null);

    return result.events;
  }
}
