import type { NotificationEvent } from '../../../shared/notification/notifier.port.js';
import { ulid } from '../../../shared/ulid.js';
import type { ConversationOwner } from '../../conversation/domain/conversation.repository.js';
import type {
  SalesRequestRepository,
  SalesRequestRow,
  SalesRequestSource,
} from '../domain/sales-request.repository.js';

/** Kejadian untuk tim internal, bentuknya sama dengan `NotificationEvent` tanpa penerimanya. */
type TeamEvent = Omit<NotificationEvent, 'userId'>;

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
    /** Memberi tahu tim internal (P27-07); `null` di tes. */
    private readonly notifyTeam: ((event: TeamEvent) => Promise<void>) | null = null,
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
    // Permintaan baru (bukan penekanan ulang) sampai ke papan admin lewat lonceng (P27-07).
    await this.notifyTeam?.({
      kind: 'contact_requested',
      subjectId: actor.id,
      data: { source },
    });
    const stored = await this.requests.findById(id);
    return {
      row: stored ?? { id, userId: actor.id, conversationId, source, createdAt: now },
      repeated: false,
    };
  }
}
