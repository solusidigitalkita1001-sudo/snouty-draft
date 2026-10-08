'use client';

/**
 * Jawaban asisten muncul bertahap (permintaan pemilik 2026-10-07: "kasih animasi transisi").
 *
 * API mengirim teks jawaban dalam satu event `token` (model tidak di-stream per token), jadi
 * efek "mengetik" dibuat di klien: teks diungkap per potongan kata, lalu kartu masuk setelah
 * teksnya selesai. Hanya untuk giliran yang lahir di sesi ini (`fresh`) — riwayat yang dibuka
 * kembali tampil utuh seketika. `prefers-reduced-motion` (SPEC §33c): tanpa animasi, langsung utuh.
 */
import { useEffect, useState } from 'react';

/**
 * Laju pengungkapan berbasis waktu, bukan per frame: minimal 110 karakter/detik (160 karakter ≈
 * 1,5 s). Per frame terlalu cepat untuk terlihat (laptop 60 fps: 160 karakter habis dalam 0,4 s)
 * dan bergantung pada refresh rate perangkat.
 *
 * Jawaban panjang dipercepat supaya total animasi tidak lewat ±2,2 detik (audit UX 2026-10-08:
 * 1.000 karakter sempat 10–12 detik, dan kartu "Susun rekomendasi" baru muncul sesudahnya).
 */
const MIN_CHARS_PER_SECOND = 110;
export const MAX_REVEAL_SECONDS = 2.2;

/** Karakter per detik untuk panjang teks tertentu — dipakai juga oleh tes. */
export function revealRate(length: number): number {
  return Math.max(MIN_CHARS_PER_SECOND, length / MAX_REVEAL_SECONDS);
}

export function useRevealedText(text: string, animate: boolean): { shown: string; done: boolean } {
  const [count, setCount] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!animate) {
      setCount(text.length);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const rate = revealRate(text.length);
    const tick = (now: number): void => {
      const target = Math.floor(((now - startedAt) / 1000) * rate);
      const next = Math.min(text.length, nextWordBoundary(text, target));
      setCount(next);
      if (next < text.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, animate]);

  const shown = text.slice(0, count);
  return { shown, done: count >= text.length };
}

/** Potong di batas kata supaya markdown setengah token (mis. `**teb`) tidak sempat terender. */
function nextWordBoundary(text: string, at: number): number {
  if (at >= text.length) return text.length;
  const space = text.indexOf(' ', at);
  const newline = text.indexOf('\n', at);
  const candidates = [space, newline].filter((i) => i !== -1);
  return candidates.length === 0 ? text.length : Math.min(...candidates);
}
