/**
 * DATA kasus untuk balasan percakapan yang ditulis model (P16-28): apa yang sudah dicatat, apa
 * yang masih kurang, status kasus, dan dasar perhitungan SNOUTY — semuanya dari state dan aturan
 * kode, bukan dari model. Model merangkai kalimat; `ReplyWriter` menolak angka yang tidak ada di
 * sini. Dengan DATA ini "mana perhitungannya?", "luasnya belum gw kasih", atau "apa aja concern
 * bikin rumah 3 lantai" bisa dijawab nyambung tanpa ada yang dikarang.
 */
import type { AssistantCard, Locale, RequirementState } from '@snouty/shared-types';
import { requirementFieldLabel } from '../domain/requirement-labels.js';
import { caseProfile, caseProfileLabel, isCaseId } from '@snouty/engineering';
import { capturedFrom } from './message-pipeline.js';
import { technicalCaptured, technicalMissing } from '../domain/technical.js';

/**
 * Dasar perhitungan mesin SNOUTY — disalin dari aturan Kelompok A–C (packages/engineering), bukan
 * dikarang: ukuran dari unit beban titik air, lantai untuk riser/pompa, dimensi hanya untuk panjang.
 */
const BASIS_ID = [
  'Ukuran pipa air bersih dihitung dari debit puncak (beban kamar mandi, wastafel, dapur), panjang jalur dari sumber ke titik air tertinggi, beda tinggi, dan jenis sumber air; untuk toren atap sisa tekanan di titik tertinggi ikut dicek.',
  'Pipa pembuangan rumah dihitung dari unit beban buangan tiap alat (kloset, floor drain, wastafel, bak cuci dapur): jalur air kotor ke septic tank dan air bekas ke saluran atau resapan, masing-masing dengan ventilasi.',
  'Ukuran rumah (panjang × lebar atau luas) dipakai untuk panjang jalur dan jumlah pipa; tanpa itu jalur diperkirakan dan jumlah pipanya tidak dihitung.',
  'Gedung bertingkat, kolam/tambak, drainase, air hujan, gorong-gorong, irigasi, cluster perumahan, transfer pompa, dan sumur masing-masing punya rumus sendiri dan dihitung saat Susun rekomendasi; industri diteruskan ke tim teknis Pralon.',
  'Hitungan disusun saat pengguna menekan Susun rekomendasi; setiap angka di solusi membawa dasar perhitungannya.',
];
const BASIS_EN = [
  'Clean-water pipe sizes are calculated from the peak flow (the load of bathrooms, basins, kitchens), the run from the source to the highest outlet, the height difference, and the water source; for a roof tank the pressure left at the highest outlet is checked too.',
  'House drainage pipes are calculated from the drainage load of each fixture (toilet, floor drain, basin, kitchen sink): a soil line to the septic tank and a waste line to the drain or soakaway, each with a vent.',
  'The house size (length × width or area) gives the run length and the pipe quantity; without it the run is estimated and the pipe quantity is not counted.',
  'Multi-storey buildings, fish ponds, drainage, stormwater, culverts, irrigation, housing clusters, pump transfer, and wells each have their own formulas and are calculated when Compose recommendation is pressed; industrial work goes to the Pralon technical team.',
  'The calculation runs when the user presses Compose recommendation; every figure in the solution carries its basis.',
];

export function caseFacts(
  state: RequirementState | null,
  locale: Locale,
  /** Kartu tindak lanjut untuk state ini (`followUpCard`) — sumber status kebijakan. */
  card: AssistantCard | null,
): string {
  const en = locale === 'en';
  if (state?.useCase?.kind === 'technical' && isCaseId(state.useCase.caseId)) {
    return technicalFacts(state, state.useCase.caseId, locale);
  }
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

/**
 * DATA kasus teknis (gedung bertingkat, kolam, drainase, …): jenis kasus, yang sudah dicatat, yang
 * masih ditanya beserta pilihannya, dan apa yang dihitung — supaya "lu belum nanya kamar mandi"
 * atau "kasih gw pilihan" dijawab nyambung, bukan dengan template yang sama.
 */
function technicalFacts(state: RequirementState, caseId: string, locale: Locale): string {
  const en = locale === 'en';
  const profile = caseProfile(caseId as Parameters<typeof caseProfile>[0]);
  const lines: string[] = [
    en ? 'CASE:' : 'KASUS:',
    `- ${caseProfileLabel(profile.id, locale)} — ${en ? profile.descriptionEn : profile.description}`,
    en ? 'RECORDED:' : 'SUDAH DICATAT:',
  ];
  const captured = technicalCaptured(state, locale);
  if (captured.length === 0) lines.push(en ? '- (nothing yet)' : '- (belum ada)');
  for (const row of captured) lines.push(`- ${row.label}: ${row.value}`);
  const missing = technicalMissing(state);
  if (missing.length > 0) {
    lines.push(
      en
        ? 'STILL ASKED (each has quick-pick options in the card below the reply, or the user can type a number):'
        : 'MASIH DITANYA (masing-masing ada pilihan cepat di kartu di bawah balasan, atau pengguna boleh mengetik angka):',
    );
    for (const m of missing) lines.push(`- ${en ? m.questionEn : m.question}`);
  }
  lines.push(
    en ? 'STATUS:' : 'STATUS:',
    en
      ? '- The user can press Compose recommendation at any time; anything not given uses an initial estimate that is marked in the result.'
      : '- Pengguna bisa menekan Susun rekomendasi kapan saja; yang belum disebut memakai perkiraan awal dan ditandai di hasil.',
    en ? 'HOW SNOUTY CALCULATES:' : 'CARA SNOUTY MENGHITUNG:',
    en
      ? `- ${profile.descriptionEn} Figures come from the formulas when Compose recommendation is pressed, then the sizes are matched to Pralon products in the catalogue.`
      : `- ${profile.description} Angkanya keluar dari rumus saat Susun rekomendasi ditekan, lalu ukurannya dicocokkan ke produk Pralon di katalog.`,
  );
  return lines.join('\n');
}
