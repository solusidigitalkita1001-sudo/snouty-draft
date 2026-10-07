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

/** Karakter per tik; satu tik per frame ±16 ms → ±180 karakter/detik, 600 karakter ≈ 3 detik. */
const CHARS_PER_TICK = 3;

export function useRevealedText(text: string, animate: boolean): { shown: string; done: boolean } {
  const [count, setCount] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!animate) {
      setCount(text.length);
      return;
    }
    let frame = 0;
    const tick = (): void => {
      setCount((current) => {
        const next = Math.min(text.length, nextWordBoundary(text, current + CHARS_PER_TICK));
        if (next < text.length) frame = requestAnimationFrame(tick);
        return next;
      });
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
