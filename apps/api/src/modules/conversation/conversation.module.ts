import { Module } from '@nestjs/common';
import { ConversationService } from './application/conversation.service.js';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from './domain/conversation.repository.js';
import { conversationRepositoryProvider } from './infrastructure/mysql-conversation.repository.js';
import { projectRepositoryProvider } from './infrastructure/mysql-project.repository.js';
import { PROJECT_REPOSITORY, type ProjectRepository } from './domain/project.repository.js';
import { ProjectService } from './application/project.service.js';
import { ConversationController } from './presentation/conversation.controller.js';
import { ProjectController } from './presentation/project.controller.js';

const conversationServiceProvider = {
  provide: ConversationService,
  inject: [CONVERSATION_REPOSITORY, PROJECT_REPOSITORY],
  useFactory: (repository: ConversationRepository, projects: ProjectRepository) =>
    new ConversationService(repository, projects),
};

const projectServiceProvider = {
  provide: ProjectService,
  inject: [PROJECT_REPOSITORY, CONVERSATION_REPOSITORY],
  useFactory: (projects: ProjectRepository, conversations: ConversationRepository) =>
    new ProjectService(projects, conversations),
};

/**
 * Konteks conversation, bagian Fase 3 (docs/ARCHITECTURE.md §6): percakapan,
 * pesan, status, judul. Context Engine (snapshot kebutuhan) menyusul di Fase 4.
 */
@Module({
  controllers: [ConversationController, ProjectController],
  providers: [
    conversationRepositoryProvider,
    projectRepositoryProvider,
    conversationServiceProvider,
    projectServiceProvider,
  ],
  exports: [conversationServiceProvider, conversationRepositoryProvider],
})
export class ConversationModule {}
