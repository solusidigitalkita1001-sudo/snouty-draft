/**
 * Use case proyek (P24-02, pemilik 2026-10-19): membuat, menamai, mencatat, dan menghapus proyek;
 * daftar konsultasi di dalamnya. Proyek hanya untuk akun (entitlement `CONVERSATION_HISTORY` di
 * controller); kepemilikan diperiksa di sini, dan milik orang lain menjawab `NOT_FOUND`.
 */
import { ulid } from '../../../shared/ulid.js';
import { EmptyMessageError, ProjectNotFoundError } from '../domain/conversation.errors.js';
import type { ConversationRepository, ConversationRow } from '../domain/conversation.repository.js';
import type {
  ProjectRepository,
  ProjectRow,
  ProjectWithCount,
} from '../domain/project.repository.js';

export const MAX_PROJECT_NAME = 80;
export const MAX_PROJECT_NOTES = 2_000;

export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly conversations: ConversationRepository,
  ) {}

  list(ownerId: string): Promise<readonly ProjectWithCount[]> {
    return this.projects.list(ownerId);
  }

  async create(ownerId: string, name: string, notes: string | null): Promise<ProjectRow> {
    const id = ulid();
    await this.projects.create({ id, ownerId, name: cleanName(name), notes: cleanNotes(notes) });
    return this.owned(id, ownerId);
  }

  async find(
    id: string,
    ownerId: string,
  ): Promise<{ project: ProjectRow; conversations: readonly ConversationRow[] }> {
    const project = await this.owned(id, ownerId);
    const conversations = await this.conversations.list({
      owner: { kind: 'user', id: ownerId },
      projectId: id,
      limit: 50,
    });
    return { project, conversations };
  }

  async update(
    id: string,
    ownerId: string,
    patch: { name?: string; notes?: string | null },
  ): Promise<ProjectRow> {
    await this.owned(id, ownerId);
    await this.projects.update(id, {
      ...(patch.name !== undefined ? { name: cleanName(patch.name) } : {}),
      ...(patch.notes !== undefined ? { notes: cleanNotes(patch.notes) } : {}),
    });
    return this.owned(id, ownerId);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    await this.owned(id, ownerId);
    await this.projects.softDelete(id);
  }

  /** Proyek aktif milik pemilik ini, atau galat — dipakai juga saat memindahkan konsultasi. */
  async owned(id: string, ownerId: string): Promise<ProjectRow> {
    const row = await this.projects.findById(id);
    if (row === null || row.deletedAt !== null || row.ownerId !== ownerId) {
      throw new ProjectNotFoundError(id);
    }
    return row;
  }
}

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_PROJECT_NAME);
  if (trimmed === '') throw new EmptyMessageError('title');
  return trimmed;
}

function cleanNotes(notes: string | null): string | null {
  if (notes === null) return null;
  const trimmed = notes.trim().slice(0, MAX_PROJECT_NOTES);
  return trimmed === '' ? null : trimmed;
}
