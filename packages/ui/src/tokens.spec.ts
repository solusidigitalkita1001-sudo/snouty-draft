import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TOKEN_GROUPS } from './tokens.js';

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

/** Nama custom property yang benar-benar didefinisikan di tokens.css. */
function definedTokens(): Set<string> {
  const names = new Set<string>();
  for (const match of css.matchAll(/^\s*--(snouty-[a-z0-9-]+)\s*:/gm)) {
    names.add(match[1]!);
  }
  return names;
}

const defined = definedTokens();
const listed = new Set(TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.name)));

describe('manifest token', () => {
  it('hanya mendaftarkan token yang benar-benar ada di tokens.css', () => {
    const phantom = [...listed].filter((name) => !defined.has(name));
    expect(phantom).toEqual([]);
  });

  it('mendaftarkan setiap token yang didefinisikan, agar pratinjau tidak menyimpan yang tersembunyi', () => {
    // Token komposit yang memang bukan nilai tunggal untuk dipratinjau.
    const exempt = new Set([
      'snouty-image-placeholder',
      'snouty-placeholder-a',
      'snouty-placeholder-b',
      'snouty-action-on',
      'snouty-focus-ring',
      'snouty-focus-border',
      'snouty-scrim',
      'snouty-scrim-strong',
      'snouty-rule',
      'snouty-font-sans',
      'snouty-font-mono',
      'snouty-tracking-hero',
      'snouty-tracking-onb',
      'snouty-tracking-title',
      'snouty-tracking-headline',
      'snouty-tracking-caption',
      'snouty-radius-tag',
      'snouty-radius-pill',
      'snouty-radius-control',
      'snouty-radius-card',
      'snouty-radius-modal',
      'snouty-radius-chip',
      'snouty-enter',
      'snouty-sheet',
      'snouty-indicator',
      'snouty-pulse',
      'snouty-flow',
      'snouty-progress',
      'snouty-onboarding-h',
      'snouty-text-intro',
      'snouty-pipe-main',
    ]);
    const missing = [...defined].filter((name) => !listed.has(name) && !exempt.has(name));
    expect(missing).toEqual([]);
  });

  it('mendefinisikan padanan gelap untuk setiap warna permukaan dan teks', () => {
    const darkBlock = css.slice(css.indexOf("[data-theme='dark']"));
    for (const name of ['snouty-canvas', 'snouty-surface', 'snouty-ink', 'snouty-border']) {
      expect(darkBlock).toContain(`--${name}:`);
    }
  });

  it('menghormati prefers-reduced-motion — prototipe tidak, SPEC §33c mewajibkannya', () => {
    expect(css).toContain('prefers-reduced-motion');
  });

  it('menjaga merah merek tetap sama di mode gelap (fill saja), dengan teks merek terpisah', () => {
    const darkBlock = css.slice(css.indexOf("[data-theme='dark']"));
    expect(darkBlock).toMatch(/--snouty-action:\s*#df301c/i);
    expect(darkBlock).toMatch(/--snouty-action-text:\s*#f4806e/i);
  });
});
