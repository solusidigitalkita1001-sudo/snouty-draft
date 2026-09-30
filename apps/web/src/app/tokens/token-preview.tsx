'use client';

import { useEffect, useState } from 'react';
import { TOKEN_GROUPS, type TokenEntry, type TokenGroup } from '@snouty/ui/tokens';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Pratinjau design token.
 *
 * Nilai yang ditampilkan dibaca dengan `getComputedStyle` dari dokumen yang
 * sedang berjalan, bukan ditulis ulang di sini. Artinya halaman ini tidak bisa
 * berbohong: yang Anda lihat adalah nilai yang benar-benar dipakai aplikasi,
 * dan ia ikut berubah saat tema dialihkan.
 */
export function TokenPreview() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    function read() {
      const style = getComputedStyle(document.documentElement);
      const next: Record<string, string> = {};
      for (const group of TOKEN_GROUPS) {
        for (const token of group.tokens) {
          next[token.name] = style.getPropertyValue(`--${token.name}`).trim();
        }
      }
      setValues(next);
    }
    read();

    // Baca ulang saat data-theme berubah.
    const observer = new MutationObserver(() => setThemeTick((t) => t + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, [themeTick]);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <div>
          <p style={caption}>Design token · packages/ui</p>
          <h1
            style={{
              fontSize: 'var(--snouty-text-title)',
              fontWeight: 600,
              letterSpacing: 'var(--snouty-tracking-title)',
              margin: '6px 0 0',
            }}
          >
            Token SNOUTY
          </h1>
        </div>
        <ThemeToggle />
      </header>

      <p
        style={{
          fontSize: 'var(--snouty-text-desc)',
          lineHeight: 1.6,
          color: 'var(--snouty-muted)',
          maxWidth: 680,
          marginBottom: 32,
        }}
      >
        Nilai di bawah dibaca langsung dari dokumen yang sedang berjalan, jadi halaman ini selalu
        menunjukkan token yang sebenarnya dipakai. Alihkan tema untuk memeriksa pasangan terang dan
        gelap.
      </p>

      {TOKEN_GROUPS.map((group) => (
        <Group key={group.title} group={group} values={values} />
      ))}
    </main>
  );
}

function Group({ group, values }: { group: TokenGroup; values: Record<string, string> }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2
        style={{
          fontSize: 'var(--snouty-text-section)',
          fontWeight: 600,
          margin: '0 0 6px',
        }}
      >
        {group.title}
      </h2>

      {group.rule ? (
        <p
          style={{
            fontSize: 'var(--snouty-text-helper)',
            lineHeight: 1.55,
            color: 'var(--snouty-assumed-body)',
            background: 'var(--snouty-assumed-bg-soft)',
            border: '1px solid var(--snouty-assumed-border)',
            borderRadius: 'var(--snouty-radius-card)',
            padding: '10px 13px',
            margin: '0 0 14px',
            maxWidth: 760,
          }}
        >
          {group.rule}
        </p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {group.tokens.map((token) => (
          <TokenCard key={token.name} token={token} kind={group.kind} value={values[token.name]} />
        ))}
      </div>
    </section>
  );
}

function TokenCard({
  token,
  kind,
  value,
}: {
  token: TokenEntry;
  kind: TokenGroup['kind'];
  value: string | undefined;
}) {
  return (
    <div
      style={{
        background: 'var(--snouty-surface)',
        border: '1px solid var(--snouty-border-soft)',
        borderRadius: 'var(--snouty-radius-card)',
        overflow: 'hidden',
        boxShadow: 'var(--snouty-shadow-card)',
      }}
    >
      <Sample name={token.name} kind={kind} />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <code
          style={{
            fontFamily: 'var(--snouty-font-mono)',
            fontSize: 'var(--snouty-text-micro)',
            color: 'var(--snouty-ink-3)',
          }}
        >
          --{token.name}
        </code>
        <span
          style={{
            fontSize: 'var(--snouty-text-helper)',
            color: 'var(--snouty-muted)',
            lineHeight: 1.45,
          }}
        >
          {token.use}
        </span>
        <code
          style={{
            fontFamily: 'var(--snouty-font-mono)',
            fontSize: 'var(--snouty-text-micro)',
            color: 'var(--snouty-caption)',
            wordBreak: 'break-all',
          }}
        >
          {value || '—'}
        </code>
      </div>
    </div>
  );
}

function Sample({ name, kind }: { name: string; kind: TokenGroup['kind'] }) {
  const v = `var(--${name})`;

  if (kind === 'color') {
    return (
      <div
        style={{
          height: 56,
          background: v,
          borderBottom: '1px solid var(--snouty-border-soft)',
        }}
      />
    );
  }

  if (kind === 'shadow') {
    return (
      <div
        style={{
          height: 76,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--snouty-canvas)',
          borderBottom: '1px solid var(--snouty-border-soft)',
        }}
      >
        <div
          style={{
            width: 120,
            height: 40,
            background: 'var(--snouty-surface)',
            borderRadius: 'var(--snouty-radius-card)',
            boxShadow: v,
          }}
        />
      </div>
    );
  }

  if (kind === 'metric') {
    return (
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          background: 'var(--snouty-canvas)',
          borderBottom: '1px solid var(--snouty-border-soft)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: v,
            maxWidth: '100%',
            height: 10,
            background: 'var(--snouty-action)',
            borderRadius: 2,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        background: 'var(--snouty-canvas)',
        borderBottom: '1px solid var(--snouty-border-soft)',
        overflow: 'hidden',
      }}
    >
      <span style={{ fontSize: v, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap' }}>Ag</span>
    </div>
  );
}

const caption = {
  fontFamily: 'var(--snouty-font-mono)',
  fontSize: 'var(--snouty-text-caption)',
  letterSpacing: 'var(--snouty-tracking-caption)',
  color: 'var(--snouty-caption)',
  textTransform: 'uppercase',
  margin: 0,
} as const;
