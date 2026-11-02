/**
 * P32-52 — "pipa lama saya masih bisa dipakai ngga?" dijawab dari KASUS pengguna, bukan dari
 * pengetahuan umum. Di produksi 2026-11-02 pertanyaan itu (di percakapan renovasi ruko yang sudah
 * mencatat pipa utama lama 3") dijawab umur pakai pipa pada umumnya lalu dilempar ke tim teknis —
 * padahal hitungan renovasi memang memeriksa kapasitas pipa lama (ENG-901).
 *
 * **Tanpa LLM dan tanpa membandingkan ukuran sendiri.** Perbandingannya milik engine; di sini
 * hanya hasilnya yang diucapkan. Yang belum diperiksa dikatakan belum diperiksa, beserta data yang
 * membuatnya belum bisa.
 */
import { DEFAULT_LOCALE, type Locale, type RequirementState } from '@snouty/shared-types';
import type { ActiveSolution } from '../domain/active-solution.port.js';

export function existingPipeReply(
  state: RequirementState,
  solution: ActiveSolution | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const en = locale === 'en';
  const check = solution?.recommendation.existingPipe ?? null;
  const stated = state.water.existingMainSize?.value ?? null;

  if (check !== null && check.sufficient !== null) {
    const size = check.size ?? stated ?? '';
    // Yang diperiksa adalah UKURAN; kondisi fisik pipa lama tidak bisa dilihat dari sini, dan
    // mengatakannya bisa dipakai tanpa catatan itu akan melebihi yang dihitung.
    return check.sufficient
      ? en
        ? `The existing ${size} main is big enough for the total load, so the calculation keeps it${check.requiredSize === undefined ? '' : ` — the load needs ${check.requiredSize}`}. That is the size; the state of the pipe itself, leaks, scale inside and old joints, still has to be seen on site.`
        : `Pipa utama lama ${size} cukup untuk beban totalnya, jadi hitungannya tetap memakai pipa itu${check.requiredSize === undefined ? '' : ` — bebannya butuh ${check.requiredSize}`}. Itu dari sisi ukuran; kondisi pipanya sendiri, kebocoran, kerak di dalam, dan sambungan lama, tetap perlu dilihat di lapangan.`
      : en
        ? `The existing ${size} main is too small for the total load${check.requiredSize === undefined ? '' : `, which needs ${check.requiredSize}`}, so the calculation replaces it.`
        : `Pipa utama lama ${size} kurang untuk beban totalnya${check.requiredSize === undefined ? '' : `, yang butuh ${check.requiredSize}`}, jadi hitungannya menggantinya.`;
  }

  if (check !== null && check.mode === 'replace_all') {
    const size = check.size ?? stated;
    return en
      ? `The work is recorded as replacing every pipe, so this calculation does not reuse the existing${size === null ? ' pipe' : ` ${size} main`}; the sizes in the solution are for new pipe along the same runs.`
      : `Pekerjaannya tercatat ganti semua pipa, jadi hitungan ini tidak memakai${size === null ? ' pipa lama' : ` pipa utama lama ${size}`}; ukuran di solusi untuk pipa baru di jalur yang sama.`;
  }

  // Kapasitasnya belum diperiksa: alasannya datang dari hitungan renovasi sendiri bila ada,
  // kalau tidak dari data yang masih kurang.
  const reason =
    check?.uncheckedReason ??
    (stated === null
      ? en
        ? 'the size of the existing pipe was not given'
        : 'ukuran pipa lamanya belum disebut'
      : en
        ? 'the sizes have not been calculated yet'
        : 'ukurannya belum dihitung');
  const size = check?.size ?? stated;
  return en
    ? `Whether the existing${size === null ? ' pipe' : ` ${size} main`} still copes is not checked yet: ${reason}. Give me that and I will compare it with the size the load needs.`
    : `Pipa${size === null ? ' lamanya' : ` utama lama ${size}`} belum saya cek cukup atau tidak: ${reason}. Sebutkan itu dan saya bandingkan dengan ukuran yang dibutuhkan bebannya.`;
}
