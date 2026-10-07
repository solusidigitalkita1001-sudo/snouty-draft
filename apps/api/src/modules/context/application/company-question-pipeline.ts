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
import { resolveCompanySubject } from '../domain/subject.js';
import { endEvent } from './message-pipeline.js';

export interface CompanyQuestionInput {
  readonly messageId: string;
  readonly message: string;
  readonly subject: ConversationSubject | undefined;
  readonly locale?: Locale;
}

export interface CompanyQuestionResult {
  readonly events: readonly AssistantStreamEvent[];
  readonly subject: ConversationSubject;
}

/** "pralon itu apa?" tanpa subjek: dijawab sebagai perusahaan, plus satu kalimat pembeda produk. */
const BARE_QUESTION =
  /^\W*(?:pralon\W+(?:itu|tuh)?\W*apa(?:an)?|apa(?:\s+itu|\s+sih)?\W+pralon|what\W+is\W+pralon)\W*$/i;

export async function runCompanyQuestion(
  knowledge: Pick<CompanyKnowledgeService, 'answer'>,
  input: CompanyQuestionInput,
): Promise<CompanyQuestionResult> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const { subject, resolvedFromPrevious } = resolveCompanySubject(input.message, input.subject);
  const ambiguous = !resolvedFromPrevious && BARE_QUESTION.test(input.message);
  const answer = await knowledge.answer({
    depth: subject.depth,
    topic: subject.topic,
    locale,
    ambiguous,
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
