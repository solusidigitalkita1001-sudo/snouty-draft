/**
 * DATA kasus untuk balasan percakapan yang ditulis model (P16-28): apa yang sudah dicatat, apa
 * yang masih kurang, status kasus, dan dasar perhitungan SNOUTY — semuanya dari state dan aturan
 * kode, bukan dari model. Model merangkai kalimat; `ReplyWriter` menolak angka yang tidak ada di
 * sini. Dengan DATA ini "mana perhitungannya?", "luasnya belum gw kasih", atau "apa aja concern
 * bikin rumah 3 lantai" bisa dijawab nyambung tanpa ada yang dikarang.
 */
import type { AssistantCard, Locale, RequirementState } from '@snouty/shared-types';
import { requirementFieldLabel } from '../domain/requirement-labels.js';
import { capturedFrom } from './message-pipeline.js';

/**
 * Dasar perhitungan mesin SNOUTY — disalin dari aturan Kelompok A–C (packages/engineering), bukan
 * dikarang: ukuran dari unit beban titik air, lantai untuk riser/pompa, dimensi hanya untuk panjang.
 */
const BASIS_ID = [
  'Ukuran pipa air bersih dihitung dari jumlah titik air (kamar mandi, wastafel, dapur) sebagai unit beban, jumlah lantai, dan sumber air.',
  'Luas bangunan tidak menentukan ukuran pipa; panjang jalur utama hanya dipakai untuk memperkirakan panjang pipa di daftar material — tanpa itu panjangnya ditandai estimasi.',
  'Saluran pembuangan, kolam, irigasi skala besar, dan kebutuhan khusus dihitung tim teknis Pralon.',
  'Hitungan disusun saat pengguna menekan Susun rekomendasi; setiap angka di solusi membawa dasar perhitungannya.',
];
const BASIS_EN = [
  'Clean-water pipe sizes are calculated from the number of water outlets (bathrooms, basins, kitchens) as load units, the number of floors, and the water source.',
  'Building area does not determine pipe size; the main run length is only used to estimate pipe length in the material list — without it the length is marked as an estimate.',
  'Drainage, ponds, large irrigation, and special needs are calculated by the Pralon technical team.',
  'The calculation runs when the user presses Compose recommendation; every figure in the solution carries its basis.',
];

export function caseFacts(
  state: RequirementState | null,
  locale: Locale,
  /** Kartu tindak lanjut untuk state ini (`followUpCard`) — sumber status kebijakan. */
  card: AssistantCard | null,
): string {
  const en = locale === 'en';
  const lines: string[] = [];
  const captured = state ? capturedFrom(state, locale) : [];
  lines.push(en ? 'RECORDED REQUIREMENTS:' : 'KEBUTUHAN YANG SUDAH DICATAT:');
  if (captured.length === 0) lines.push(en ? '- (nothing yet)' : '- (belum ada)');
  for (const row of captured) lines.push(`- ${row.label}: ${row.value}`);

  const missing = state?.missingInformation ?? [];
  if (missing.length > 0) {
    lines.push(en ? 'STILL MISSING:' : 'MASIH KURANG:');
    for (const path of missing) lines.push(`- ${requirementFieldLabel(path, locale)}`);
  }

  lines.push(en ? 'CASE STATUS:' : 'STATUS KASUS:');
  if (card?.kind === 'unsupported') {
    lines.push(
      en
        ? '- Handed to the Pralon technical team (not calculated automatically):'
        : '- Diserahkan ke tim teknis Pralon (tidak dihitung otomatis):',
      ...card.reasons.map((r) => `  - ${r}`),
    );
  } else if (missing.length > 0) {
    lines.push(
      en
        ? '- Incomplete: no solution yet; the missing items above are needed first.'
        : '- Belum lengkap: belum ada solusi; yang masih kurang di atas diperlukan dulu.',
    );
  } else if (state !== null && captured.length > 0) {
    lines.push(
      en
        ? '- Complete: the user can press Compose recommendation to get pipe sizes and the product list.'
        : '- Lengkap: pengguna bisa menekan Susun rekomendasi untuk melihat ukuran pipa dan daftar produk.',
    );
  } else {
    lines.push(en ? '- No case started yet.' : '- Belum ada kasus.');
  }

  lines.push(en ? 'HOW SNOUTY CALCULATES:' : 'CARA SNOUTY MENGHITUNG:');
  for (const fact of en ? BASIS_EN : BASIS_ID) lines.push(`- ${fact}`);
  return lines.join('\n');
}
