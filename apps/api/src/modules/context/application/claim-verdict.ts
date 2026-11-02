/**
 * Klaim ukuran yang diminta dinilai — "tukang saya bilang pipa 1/2 inci cukup buat 3 lantai, bener
 * ga?" (P32-10, keputusan pemilik 2026-11-02: hitung dengan anggapan wajar, lalu jawab klaimnya).
 *
 * Angkanya dari engine, bukan dari model: `computeSolution` dipanggil dengan masukan yang sama
 * dengan layar solusi (`solutionInputFrom`), jadi ukuran yang dikatakan di chat tidak bisa berbeda
 * dari ukuran yang muncul di hitungannya. Anggapan yang dipakai sudah disebut kalimat sebelumnya.
 */
import { computeSolution, PVC_INCH_SIZES } from '@snouty/engineering';
import { DEFAULT_LOCALE, type Locale, type RequirementState } from '@snouty/shared-types';
import { solutionInputFrom } from '../domain/solution-input.js';

/**
 * Jawaban atas klaim ukuran, atau `null` bila kebutuhannya belum bisa dihitung — penilaian tanpa
 * hitungan hanya akan jadi pendapat.
 */
export function claimVerdict(
  state: RequirementState,
  claimedSize: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (state.useCase !== undefined) return null;
  let main: string;
  let branch: string;
  try {
    const solution = computeSolution(
      solutionInputFrom(state),
      locale === 'en' ? 'en' : 'id',
      state.assumptionOverrides ?? {},
    );
    main = solution.mainSize;
    branch = solution.branchSize;
  } catch {
    return null;
  }
  const en = locale === 'en';
  const claimed = claimedSize === null ? null : matchedSize(claimedSize);
  const claimedValue = claimed === null ? null : inchValue(claimed);
  const mainValue = inchValue(main);
  if (claimed === null || claimedValue === null || mainValue === null) {
    return en
      ? `That works out to a ${main} main line, with ${branch} branches on each floor.`
      : `Hitungannya: pipa utamanya ${main}, cabang di tiap lantainya ${branch}.`;
  }
  const difference = claimedValue - mainValue;
  if (difference < 0) {
    return en
      ? `That works out to a ${main} main line, so ${claimed} is not enough — ${claimed} is the size for the connection to a tap or a shower, not for the line coming up from the source.`
      : `Hitungannya, pipa utamanya ${main} — jadi ${claimed} tidak cukup. Ukuran ${claimed} tempatnya di sambungan ke keran dan shower, bukan di pipa yang naik dari sumber air.`;
  }
  if (difference === 0) {
    return en
      ? `That works out to a ${main} main line, so ${claimed} is right.`
      : `Hitungannya, pipa utamanya ${main} — jadi ${claimed} memang pas.`;
  }
  return en
    ? `That works out to a ${main} main line, so ${claimed} is larger than it needs to be — not wrong, just more expensive.`
    : `Hitungannya, pipa utamanya ${main} — jadi ${claimed} lebih besar dari yang dibutuhkan. Tidak salah, hanya lebih mahal.`;
}

/** Ukuran yang disebut pengguna → notasi tabel ukuran ("1 1/4" → `1¼"`); `null` bila bukan inci. */
function matchedSize(size: string): string | null {
  const value = inchValue(size);
  if (value === null) return null;
  return PVC_INCH_SIZES.find((row) => inchValue(row.size) === value)?.size ?? null;
}

/** Nilai inci sebuah label ukuran: "1 1/4", `1¼"`, "3/4", "2" — `null` untuk mm dan bukan ukuran. */
function inchValue(size: string | null): number | null {
  if (size === null) return null;
  if (/mm/i.test(size)) return null;
  const plain = size
    .replace(/"/g, '')
    .replace(/¼/g, ' 1/4')
    .replace(/½/g, ' 1/2')
    .replace(/¾/g, ' 3/4')
    .trim();
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(plain);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(plain);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const whole = /^(\d+(?:[.,]\d+)?)$/.exec(plain);
  return whole ? Number(whole[1]!.replace(',', '.')) : null;
}
