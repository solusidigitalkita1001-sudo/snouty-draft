/**
 * Ruas PERTANYAAN PERUSAHAAN (Fase 16): "Pralon itu apa?", "company profile PT Pralon",
 * lalu "boleh" / "lengkap dong" / "semuanya". Nol ekstraksi, nol model: subjek percakapan
 * menentukan topik dan kedalaman, `CompanyKnowledgeService` memberi fakta terverifikasi.
 *
 * Kegagalan retrieval (katalog tidak terbaca, bagian belum ada) bukan pergantian topik:
 * jawabannya tetap tentang perusahaan — "yang bisa saya verifikasi adalah …" — dan tidak pernah
 * "Produk mana yang Anda maksud?".
 */
import {
  DEFAULT_LOCALE,
  type AssistantStreamEvent,
  type ConversationSubject,
  type Locale,
} from '@snouty/shared-types';
import type { CompanyKnowledgeService } from '../../company-knowledge/application/company-knowledge.service.js';
import type { MessageUnderstanding } from '../../understanding/application/message-understanding.js';
import { resolveCompanySubject } from '../domain/subject.js';
import { sectionsShownAt } from '../../company-knowledge/domain/company-answer.js';
import { endEvent } from './message-pipeline.js';

export interface CompanyQuestionInput {
  readonly messageId: string;
  readonly understanding: MessageUnderstanding;
  readonly subject: ConversationSubject | undefined;
  readonly locale?: Locale;
}

export interface CompanyQuestionResult {
  readonly events: readonly AssistantStreamEvent[];
  readonly subject: ConversationSubject;
}

export async function runCompanyQuestion(
  knowledge: Pick<CompanyKnowledgeService, 'answer'>,
  input: CompanyQuestionInput,
): Promise<CompanyQuestionResult> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const u = input.understanding;
  const { subject, resolvedFromPrevious } = resolveCompanySubject(u, input.subject);
  // "pralon itu apa?" tanpa subjek dan tanpa bagian profil yang spesifik: "Pralon" bisa berarti
  // perusahaan atau produk — dijawab sebagai perusahaan, plus satu kalimat pembeda produk.
  const ambiguous = !resolvedFromPrevious && u.companyTopic === null;
  // Lanjutan atas topik yang sama ("boleh", "lengkap dong") hanya menambah bagian yang belum
  // diceritakan — dulu seluruh jawaban diulang lalu ditambah (audit keterbacaan 2026-10-08).
  const previous = input.subject;
  const alreadyShown =
    resolvedFromPrevious && previous?.kind === 'company' && previous.topic === subject.topic
      ? sectionsShownAt(previous.depth)
      : 0;
  const answer = await knowledge.answer({
    depth: subject.depth,
    topic: subject.topic,
    locale,
    ambiguous,
    alreadyShown,
  });
  return {
    subject,
    events: [
      { type: 'message.start', messageId: input.messageId },
      { type: 'token', text: answer.text },
      ...(answer.needsTeam
        ? [{ type: 'card', card: { kind: 'cta', action: 'CONTACT_TECHNICAL' } } as const]
        : []),
      endEvent(input.messageId),
    ],
  };
}
