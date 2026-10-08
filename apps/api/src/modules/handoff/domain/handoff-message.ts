/**
 * Isi email kasus untuk tim teknis Pralon (P10-06, OQ-08) — **fungsi murni**.
 *
 * Penerimanya teknisi, bukan pengguna: yang penting kebutuhan terbaca sekali pandang, asumsi
 * sistem dipisah dari yang dinyatakan pengguna (tim harus tahu angka mana yang ditebak), dan
 * lampiran disebut supaya denahnya dibuka di back-office. Teks polos, bukan HTML: klien email
 * dan n8n sama-sama menampilkannya apa adanya, dan tidak ada markup yang bisa disisipkan
 * lewat isian pengguna.
 */
import type { KeyValue } from '@snouty/shared-types';
import type { HandoffRow } from './handoff.repository.js';

export interface HandoffMessage {
  readonly handoffId: string;
  readonly conversationId: string;
  readonly subject: string;
  readonly text: string;
}

const ASSUMPTION = 'asumsi:';
const ATTACHMENT = 'lampiran:';
/** Subjek email dipotong — alasan kebijakan bisa panjang, kotak masuk tidak. */
const SUBJECT_REASON_MAX = 80;

export function handoffMessage(row: HandoffRow): HandoffMessage {
  const stated = row.captured.filter(
    (kv) => !kv.label.startsWith(ASSUMPTION) && !kv.label.startsWith(ATTACHMENT),
  );
  const assumptions = row.captured.filter((kv) => kv.label.startsWith(ASSUMPTION));
  const attachments = row.captured.filter((kv) => kv.label.startsWith(ATTACHMENT));

  const lines: string[] = [
    'Kasus baru diserahkan ke tim teknis lewat SNOUTY.',
    '',
    `Alasan: ${oneLine(row.reason)}`,
    `Diterima: ${row.createdAt.toISOString()}`,
    `ID handoff: ${row.id}`,
    `ID percakapan: ${row.conversationId}`,
  ];
  lines.push('', 'Kebutuhan dari pengguna:');
  if (stated.length === 0) lines.push('- (belum ada yang tercatat)');
  for (const kv of stated) lines.push(bullet(kv.label, kv.value));
  if (assumptions.length > 0) {
    lines.push('', 'Asumsi sistem (perlu diperiksa):');
    for (const kv of assumptions) lines.push(`- ${oneLine(kv.value)}`);
  }
  if (attachments.length > 0) {
    lines.push('', 'Lampiran (buka di back-office dengan ID lampiran):');
    for (const kv of attachments) {
      lines.push(bullet(kv.label.slice(ATTACHMENT.length), kv.value));
    }
  }

  const reason = oneLine(row.reason);
  const short =
    reason.length > SUBJECT_REASON_MAX ? `${reason.slice(0, SUBJECT_REASON_MAX - 1)}…` : reason;
  return {
    handoffId: row.id,
    conversationId: row.conversationId,
    subject: `[SNOUTY] Kasus untuk tim teknis — ${short}`,
    text: lines.join('\n'),
  };
}

function bullet(label: KeyValue['label'], value: KeyValue['value']): string {
  return `- ${oneLine(label)}: ${oneLine(value)}`;
}

/** Baris baru dari isian pengguna tidak boleh memecah struktur email (atau menyisipkan header). */
function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').trim();
}
