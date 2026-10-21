/** Bentuk baris prospek di API internal — dipakai dashboard admin dan dashboard sales. */
import type { ProspectRow } from '../domain/prospect-board.js';

export function prospectDto(row: ProspectRow) {
  return {
    userId: row.user.id,
    name: row.user.name,
    email: row.user.email,
    phone: row.user.phone,
    registeredAt: row.user.createdAt.toISOString(),
    stage: row.stage,
    stageReachedAt: row.stageReachedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    scale: row.scale,
    score: row.score,
    priority: row.priority,
    salesContactConsent: row.salesContactConsent,
    salesRequestedAt: row.salesRequestedAt?.toISOString() ?? null,
    contactable: row.contactable,
    conversationCount: row.conversationCount,
    lead: row.lead && {
      salesUserId: row.lead.salesUserId,
      salesName: row.lead.salesName,
      status: row.lead.status,
      assignedAt: row.lead.assignedAt.toISOString(),
    },
  };
}
