/**
 * Antrean handoff teknis — Fase 8. Enqueue dari layar 11; konsumernya (notifikasi,
 * back-office) menyusul bersama desain internal (OQ-21) dan transport (OQ-40).
 */
import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { ConversationService } from '../conversation/application/conversation.service.js';
import { RequirementSnapshotStore } from '../context/application/requirement-snapshot.store.js';
import { HandoffService } from './application/handoff.service.js';
import { HANDOFF_REPOSITORY, type HandoffRepository } from './domain/handoff.repository.js';
import { handoffRepositoryProvider } from './infrastructure/mysql-handoff.repository.js';
import { HandoffController } from './presentation/handoff.controller.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { UploadsService } from '../uploads/application/uploads.service.js';

const handoffServiceProvider = {
  provide: HandoffService,
  inject: [HANDOFF_REPOSITORY, ConversationService, RequirementSnapshotStore, UploadsService],
  useFactory: (
    handoffs: HandoffRepository,
    conversations: ConversationService,
    snapshots: RequirementSnapshotStore,
    uploads: UploadsService,
  ) => new HandoffService(handoffs, conversations, snapshots, uploads),
};

@Module({
  imports: [ContextModule, ConversationModule, UploadsModule],
  controllers: [HandoffController],
  providers: [handoffRepositoryProvider, handoffServiceProvider],
  exports: [handoffServiceProvider],
})
export class HandoffModule {}
