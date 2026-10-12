'use client';

/**
 * Skema mengisi lebar kotaknya (laporan pemilik 2026-10-12: "keliatan strech, ngga fit"). Lebar
 * tata letak SVG = lebar kotak ÷ skala: garis dan jarak memanjang mengikuti kotak, sedangkan teks
 * dan kotak membesar proporsional lewat `viewBox` — tidak pernah ditarik satu arah saja. Skala naik
 * di layar lebar supaya label tetap terbaca. Dipakai skema rumah dan skema aliran kasus teknis.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';

export function useContainerWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Perbesaran gambar menurut lebar kotaknya. */
export function scaleFor(containerWidth: number): number {
  if (containerWidth >= 900) return 1.3;
  if (containerWidth >= 700) return 1.15;
  return 1;
}

/** Lebar tata letak: isi gambar minimum, atau lebar kotak ÷ skala bila kotaknya lebih lebar. */
export function fittedWidth(contentWidth: number, containerWidth: number): number {
  return Math.max(contentWidth, Math.round(containerWidth / scaleFor(containerWidth)));
}
