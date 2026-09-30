import Link from 'next/link';

/**
 * Skeleton Fase 0e — belum ada fitur. Layar 01 (Welcome) menyusul di Fase 3.
 */
export default function Home() {
  return (
    <main style={{ maxWidth: 700, margin: '0 auto', padding: '64px 24px' }}>
      <p
        style={{
          fontFamily: 'var(--snouty-font-mono)',
          fontSize: 'var(--snouty-text-caption)',
          letterSpacing: 'var(--snouty-tracking-caption)',
          color: 'var(--snouty-caption)',
          textTransform: 'uppercase',
        }}
      >
        Pralon Assistant · Skeleton Fase 0e
      </p>
      <h1
        style={{
          fontSize: 'var(--snouty-text-hero)',
          fontWeight: 600,
          letterSpacing: 'var(--snouty-tracking-hero)',
          lineHeight: 1.15,
          margin: '12px 0',
        }}
      >
        SNOUTY
      </h1>
      <p
        style={{
          fontSize: 'var(--snouty-text-section)',
          lineHeight: 1.55,
          color: 'var(--snouty-muted)',
        }}
      >
        Kerangka aplikasi. Belum ada fitur — layar produk mulai dibangun di Fase 3.
      </p>
      <p style={{ marginTop: 24 }}>
        <Link
          href="/tokens"
          style={{
            display: 'inline-block',
            background: 'var(--snouty-action)',
            color: 'var(--snouty-action-on)',
            fontSize: 'var(--snouty-text-list)',
            fontWeight: 500,
            padding: '10px 18px',
            borderRadius: 'var(--snouty-radius-control)',
            textDecoration: 'none',
          }}
        >
          Lihat design token
        </Link>
      </p>
    </main>
  );
}
