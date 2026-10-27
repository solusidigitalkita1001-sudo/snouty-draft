/**
 * Kapan hitungan berjalan sendiri, dan ke mana layarnya pergi sesudahnya.
 *
 * Pemilik 2026-10-20 (OQ-75): rumah yang jumlah lantainya disebut dihitung lebih dulu dengan
 * anggapan, tanpa menunggu tombol. Pemilik 2026-10-27: hitungannya boleh jalan, tetapi layarnya
 * TIDAK ikut berpindah — "pengen bikin rumah 2 lantai" melompat ke layar solusi, sehingga lima
 * pertanyaan yang dikirim di giliran yang sama tidak pernah terlihat, dan jawabannya berdiri di
 * atas empat hal yang tidak pernah disebut pengguna. Solusinya tetap siap, dibuka lewat tombol
 * "Lihat solusi" yang memang sudah ada begitu solusi ada.
 */
import type { AssistantCard } from '@snouty/shared-types';

export type AnalysisStart =
  /** Tidak ada yang dijalankan: pengguna yang menekan tombolnya. */
  | 'none'
  /** Jalankan hitungannya, tetap di percakapan supaya pertanyaannya terbaca. */
  | 'in-chat';

export function autoAnalysisStart(cards: readonly AssistantCard[]): AnalysisStart {
  const auto = cards.some(
    (card) => card.kind === 'cta' && card.action === 'ANALYZE' && card.auto === true,
  );
  return auto ? 'in-chat' : 'none';
}
