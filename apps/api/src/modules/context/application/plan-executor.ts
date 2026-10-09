/**
 * Menjalankan rencana giliran (P16-29) atas katalog dan state. Tindakan katalog dijawab kode
 * (jenis, ukuran, terkecil/terbesar, ragam); pertanyaan kasus dan obrolan dijawab model di atas
 * DATA kasus dengan pagar angka `ReplyWriter`. Tindakan yang sudah punya jalurnya sendiri
 * (spesifikasi produk, kebutuhan, perusahaan) dikembalikan sebagai keputusan router.
 */
import type { AssistantStreamEvent, Intent, Locale, RequirementState } from '@snouty/shared-types';
import type { RoutingDecision } from './intent-router.js';
import { caseFacts } from './case-facts.js';
import { endEvent, followUpCard } from './message-pipeline.js';
import {
  familyRange,
  familySizeAnswer,
  rangeOverview,
  type RangeCatalog,
} from './product-range.js';
import type { ReplyTurn, ReplyWriter } from './reply-writer.js';
import { openerReply } from './reply-copy.js';
import type { TurnPlan } from './turn-planner.js';
import { withCompleteness } from '../domain/completeness.js';

export interface PlanContext {
  readonly catalog: RangeCatalog;
  readonly reply: ReplyWriter | null;
  readonly messageId: string;
  readonly message: string;
  readonly recentTurns: readonly ReplyTurn[];
  readonly state: RequirementState;
  readonly locale: Locale;
  readonly hasExisting: boolean;
}

export type PlanOutcome =
  | {
      readonly kind: 'answered';
      readonly events: readonly AssistantStreamEvent[];
      /** Keluarga yang kini dibicarakan — menjadi subjek untuk lanjutan berikutnya. */
      readonly family: string | null;
    }
  | { readonly kind: 'route'; readonly decision: RoutingDecision }
  | { readonly kind: 'none' };

const IDENTITY_ID =
  'SNOUTY adalah asisten perencanaan pipa air bersih Pralon: membantu menghitung ukuran pipa dari kebutuhan bangunan, menjelaskan dan memilih produk dari katalog Pralon, dan meneruskan kasus khusus (pembuangan, kolam, irigasi besar) ke tim teknis Pralon.';
const IDENTITY_EN =
  "SNOUTY is Pralon's clean-water piping planning assistant: it sizes pipes from a building's requirements, explains and picks products from the Pralon catalogue, and passes special cases (drainage, ponds, large irrigation) to the Pralon technical team.";

const BASIS_FALLBACK_ID =
  'Ukuran pipa air bersih dihitung dari jumlah titik air, jumlah lantai, dan sumber air; luas bangunan tidak menentukan ukuran pipa — dimensi hanya dipakai untuk memperkirakan panjang pipa di daftar material.';
const BASIS_FALLBACK_EN =
  'Clean-water pipe sizes come from the number of water outlets, the number of floors, and the water source; building area does not determine pipe size — dimensions only estimate pipe length in the material list.';

function decisionFor(intent: Intent, extracting: boolean, mutating: boolean): RoutingDecision {
  return { intent, confidence: 0.9, shouldExtract: extracting, mutatesState: mutating };
}

function answered(ctx: PlanContext, text: string, family: string | null): PlanOutcome {
  return {
    kind: 'answered',
    family,
    events: [
      { type: 'message.start', messageId: ctx.messageId },
      { type: 'token', text },
      endEvent(ctx.messageId),
    ],
  };
}

export async function executePlan(plan: TurnPlan, ctx: PlanContext): Promise<PlanOutcome> {
  const en = ctx.locale === 'en';
  switch (plan.action) {
    case 'product_types': {
      if (plan.family === null) return { kind: 'none' };
      const range = await familyRange(ctx.catalog, [plan.family], ctx.locale);
      return range === null ? { kind: 'none' } : answered(ctx, range.text, plan.family);
    }
    case 'product_sizes': {
      if (plan.family === null) return { kind: 'none' };
      const sizes = await familySizeAnswer(
        ctx.catalog,
        plan.family,
        plan.type,
        plan.extreme,
        ctx.locale,
      );
      return sizes === null ? { kind: 'none' } : answered(ctx, sizes.text, plan.family);
    }
    case 'product_overview': {
      const range = await rangeOverview(ctx.catalog, ctx.locale);
      return answered(ctx, range.text, null);
    }
    case 'case_question':
    case 'chat': {
      const state = withCompleteness(ctx.state);
      const facts = [
        en ? IDENTITY_EN : IDENTITY_ID,
        caseFacts(state, ctx.locale, followUpCard(state, ctx.locale)),
      ].join('\n');
      const fallback =
        plan.action === 'case_question'
          ? en
            ? BASIS_FALLBACK_EN
            : BASIS_FALLBACK_ID
          : openerReply(ctx.locale);
      const written = ctx.reply
        ? await ctx.reply.write({
            intent: plan.action === 'chat' ? 'OUT_OF_SCOPE' : 'EXPLANATION_REQUEST',
            userMessage: ctx.message,
            recentTurns: ctx.recentTurns,
            facts,
            locale: ctx.locale,
            fallback,
          })
        : { text: fallback };
      return answered(ctx, written.text, null);
    }
    case 'product_question':
      return { kind: 'route', decision: decisionFor('PRODUCT_LOOKUP', false, false) };
    case 'company':
      return { kind: 'route', decision: decisionFor('COMPANY_QUESTION', false, false) };
    case 'requirement':
      return {
        kind: 'route',
        decision: ctx.hasExisting
          ? decisionFor('REQUIREMENT_MUTATION', true, true)
          : decisionFor('REQUIREMENT_STATEMENT', true, false),
      };
  }
}
