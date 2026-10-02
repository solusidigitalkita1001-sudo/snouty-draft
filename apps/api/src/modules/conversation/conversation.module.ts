import { Module } from '@nestjs/common';
import { ConversationService } from './application/conversation.service.js';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from './domain/conversation.repository.js';
import { conversationRepositoryProvider } from './infrastructure/mysql-conversation.repository.js';

const conversationServiceProvider = {
  provide: ConversationService,
  inject: [CONVERSATION_REPOSITORY],
  useFactory: (repository: ConversationRepository) => new ConversationService(repository),
};

/**
 * Konteks conversation, bagian Fase 3 (docs/ARCHITECTURE.md §6): percakapan,
 * pesan, status, judul. Context Engine (snapshot kebutuhan) menyusul di Fase 4.
 */
@Module({
  providers: [conversationRepositoryProvider, conversationServiceProvider],
  exports: [conversationServiceProvider, conversationRepositoryProvider],
})
export class ConversationModule {}
