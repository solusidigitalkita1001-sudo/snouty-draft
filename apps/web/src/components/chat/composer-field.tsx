'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';

/** Tinggi maksimum sebelum bidang mulai menggulir — kira-kira enam baris teks. */
const MAX_HEIGHT_PX = 168;

interface ComposerFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly placeholder: string;
  readonly ariaLabel: string;
  readonly className: string;
}

/**
 * Bidang ketik composer: textarea yang tumbuh mengikuti isinya (keputusan pemilik 2026-10-07 —
 * input satu baris terasa sempit dan tidak modern). Enter mengirim, Shift+Enter membuat baris
 * baru; tingginya kembali ke satu baris saat draf dikosongkan setelah terkirim.
 */
export function ComposerField({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
  className,
}: ComposerFieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={1}
    />
  );
}
