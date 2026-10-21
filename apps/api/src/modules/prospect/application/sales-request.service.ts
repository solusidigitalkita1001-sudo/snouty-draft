import { ulid } from '../../../shared/ulid.js';
import type { ConversationOwner } from '../../conversation/domain/conversation.repository.js';
import type {
  SalesRequestRepository,
  SalesRequestRow,
  SalesRequestSource,
} from '../domain/sales-request.repository.js';

/** Penekanan ulang dalam sehari dianggap permintaan yang sama — sales tidak menerima duplikat. */
const SAME_REQUEST_WINDOW_MS = 24 * 60 * 60 * 1000;

interface OwnedConversations {
  /** Melempar NOT_FOUND bila percakapan bukan milik aktor. */
  find(id: string, actor: ConversationOwner): Promise<unknown>;
}

export class SalesRequestService {
  constructor(
    private readonly requests: SalesRequestRepository,
    private readonly conversations: OwnedConversations,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * Mencatat permintaan dihubungi dari sebuah percakapan. Hak aksesnya (pengguna terdaftar) diperiksa
   * di controller lewat entitlement; di sini kepemilikan percakapan dan penekanan ganda.
   */
  async request(
    conversationId: string,
    actor: ConversationOwner,
    source: SalesRequestSource,
  ): Promise<{ readonly row: SalesRequestRow; readonly repeated: boolean }> {
    await this.conversations.find(conversationId, actor);
    const now = this.clock();
    const earlier = await this.requests.latestSince(
      actor.id,
      conversationId,
      new Date(now.getTime() - SAME_REQUEST_WINDOW_MS),
    );
    if (earlier !== null) return { row: earlier, repeated: true };

    const id = ulid();
    await this.requests.create({ id, userId: actor.id, conversationId, source });
    const stored = await this.requests.findById(id);
    return {
      row: stored ?? { id, userId: actor.id, conversationId, source, createdAt: now },
      repeated: false,
    };
  }
}
