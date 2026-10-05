/**
 * Mood mascot dari **state sistem** — tidak pernah dipilih LLM. docs/DESIGN_IMPLEMENTATION.md §7.
 *
 * Ketiga belas mood ini persis yang bisa digambar `Snouty` (port dari prototipe). `greet`
 * dan `peek` dari lembar mascot belum punya gambar di prototipe (OQ-30), jadi belum ada di sini.
 */
import type { AnalysisStage, AssistantCard } from '@snouty/shared-types';

export type Mood =
  | 'idle'
  | 'write'
  | 'think'
  | 'happy'
  | 'drip'
  | 'fail'
  | 'surprised'
  | 'confused'
  | 'sorry'
  | 'wink'
  | 'thanks'
  | 'focus'
  | 'sleep';

export const MOODS: readonly Mood[] = [
  'idle',
  'write',
  'think',
  'happy',
  'drip',
  'fail',
  'surprised',
  'confused',
  'sorry',
  'wink',
  'thanks',
  'focus',
  'sleep',
];

/** Potongan state sistem yang menentukan mood; setiap flag dievaluasi berurutan (§7). */
export interface MascotState {
  /** Error sistem sedang tampil — satu-satunya jalan ke `fail`. */
  readonly systemError?: boolean;
  /** Rate limited, koneksi putus, atau data tidak ada di katalog. */
  readonly unavailable?: boolean;
  /** Pesan tidak dipahami → klarifikasi. */
  readonly clarifying?: boolean;
  /** Validasi teknis / di luar cakupan. */
  readonly outOfScope?: boolean;
  /** Perubahan besar setelah edit, atau skenario tak terduga. */
  readonly surprised?: boolean;
  readonly stage?: AnalysisStage | null;
  /** Solusi siap, laporan terunduh. */
  readonly solutionReady?: boolean;
  /** Feedback diberikan, solusi disimpan, registrasi berhasil. */
  readonly thanked?: boolean;
  /** Tips / kartu kriteria netral. */
  readonly tip?: boolean;
  /** Loading ringan / tips perawatan. */
  readonly lightLoading?: boolean;
  /** Welcome diam ≥ 15 detik dengan composer kosong, atau offline. */
  readonly asleep?: boolean;
}

const THINK_STAGES: readonly AnalysisStage[] = ['UNDERSTANDING', 'ANALYZING_INSTALLATION'];

export function moodFor(state: MascotState): Mood {
  if (state.systemError) return 'fail';
  if (state.unavailable) return 'sorry';
  if (state.clarifying) return 'confused';
  if (state.outOfScope) return 'focus';
  if (state.surprised) return 'surprised';
  if (state.stage) return THINK_STAGES.includes(state.stage) ? 'think' : 'write';
  if (state.solutionReady) return 'happy';
  if (state.thanked) return 'thanks';
  if (state.tip) return 'wink';
  if (state.lightLoading) return 'drip';
  if (state.asleep) return 'sleep';
  return 'idle';
}

/** Mood avatar sebuah giliran asisten, dari kartu yang dibawanya — port `moodOf` prototipe. */
export function moodForCards(cards: readonly AssistantCard[]): Mood {
  const kinds = new Set(cards.map((card) => card.kind));
  if (kinds.has('unsupported')) return 'focus';
  if (kinds.has('criteria')) return 'wink';
  if (kinds.has('clarification')) return 'confused';
  if (kinds.has('summary') || kinds.has('cta')) return 'happy';
  return 'idle';
}
