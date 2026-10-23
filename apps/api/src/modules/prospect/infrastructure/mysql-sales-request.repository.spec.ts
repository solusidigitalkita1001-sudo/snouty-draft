/** P26-04 — "minta dihubungi": pemilik percakapan saja, penekanan ganda satu permintaan, sumber dibatasi. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import { ConversationNotFoundError } from '../../conversation/domain/conversation.errors.js';
import type { ConversationOwner } from '../../conversation/domain/conversation.repository.js';
import { MysqlConversationRepository } from '../../conversation/infrastructure/mysql-conversation.repository.js';
import { SalesRequestService } from '../application/sales-request.service.js';
import { MysqlSalesRequestRepository } from './mysql-sales-request.repository.js';

const USER: ConversationOwner = { kind: 'user', id: testId('SRUSER') };
const OTHER: ConversationOwner = { kind: 'user', id: testId('SROTHER') };

let fixture: TestDatabase;
let conversations: ConversationService;
let repository: MysqlSalesRequestRepository;

beforeAll(async () => {
  fixture = await createTestDatabase('sales_requests');
  conversations = new ConversationService(new MysqlConversationRepository({ db: fixture.db }));
  repository = new MysqlSalesRequestRepository({ db: fixture.db });
});
afterAll(async () => {
  await fixture.close();
});
beforeEach(async () => {
  await fixture.clear();
});

describe('permintaan dihubungi sales di MySQL (0027)', () => {
  it('tercatat untuk pemilik percakapan; ditekan lagi = permintaan yang sama', async () => {
    const service = new SalesRequestService(repository, conversations);
    const conversation = await conversations.create(USER);

    const first = await service.request(conversation.id, USER, 'price');
    const again = await service.request(conversation.id, USER, 'solution');

    expect(first.repeated).toBe(false);
    expect(first.row).toMatchObject({
      userId: USER.id,
      conversationId: conversation.id,
      source: 'price',
    });
    expect(again).toMatchObject({ repeated: true, row: { id: first.row.id } });
  });

  it('sehari kemudian adalah permintaan baru', async () => {
    const conversation = await conversations.create(USER);
    const first = await new SalesRequestService(repository, conversations).request(
      conversation.id,
      USER,
      'solution',
    );
    const tomorrow = new SalesRequestService(
      repository,
      conversations,
      null,
      () => new Date(Date.now() + 25 * 60 * 60 * 1000),
    );
    const later = await tomorrow.request(conversation.id, USER, 'solution');
    expect(later.repeated).toBe(false);
    expect(later.row.id).not.toBe(first.row.id);
  });

  it('percakapan orang lain: NOT_FOUND, tidak ada baris', async () => {
    const conversation = await conversations.create(OTHER);
    await expect(
      new SalesRequestService(repository, conversations).request(conversation.id, USER, 'price'),
    ).rejects.toBeInstanceOf(ConversationNotFoundError);
    expect(await repository.latestSince(USER.id, conversation.id, new Date(0))).toBeNull();
  });

  it('sumber di luar daftar ditolak database', async () => {
    await expect(
      repository.create({
        id: testId('SRBAD'),
        userId: USER.id,
        conversationId: null,
        source: 'email' as never,
      }),
    ).rejects.toThrow();
  });
});
