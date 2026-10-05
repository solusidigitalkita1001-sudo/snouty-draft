'use client';

/**
 * Layar 10 — drawer detail produk. Dari prototipe baru (maks 600px, tanpa tab, satu
 * kolom bergulir). docs/DESIGN_IMPLEMENTATION.md, docs/PRODUCT_KNOWLEDGE.md.
 *
 * Pengetahuan teknis, bukan halaman toko: tanpa harga, tanpa keranjang. Setiap nilai
 * datang dari katalog; spesifikasi `UNAVAILABLE` tidak merender nilai sama sekali
 * melainkan "Lihat dokumen teknis". Prototipe tidak memasang tag provenance di sini —
 * teks itu sendiri yang membawa maknanya, jadi warna bukan satu-satunya pembeda.
 *
 * Yang ditambahkan di luar prototipe, karena diwajibkan §12: focus trap, Esc menutup,
 * dan fokus kembali ke kartu yang membukanya.
 */

import { specHasValue, type SelectedProduct, type SpecValue } from '@snouty/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';

import { SnoutyAvatar } from '../mascot/snouty';
import { SOLUTION_COPY } from '../solution/solution-copy';
import { loadProduct, type ProductLoad } from './product-api';
import { PRODUCT_COPY as COPY, sourceLine, specSourceLine } from './product-copy';
import styles from './product-drawer.module.css';

const SPEC_ORDER = [
  'material',
  'standard',
  'rodLength',
  'jointType',
  'application',
  'pressureClass',
] as const;

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DrawerSelection {
  readonly productId: string;
  /**
   * Ukuran yang dipakai solusi — disorot di "UKURAN TERSEDIA". Kosong untuk produk yang
   * dibuka dari jawaban pengetahuan produk: ia tidak "dipakai di solusi" mana pun.
   */
  readonly size?: string;
  readonly matchState?: SelectedProduct['matchState'];
}

export function ProductDrawer({
  selection,
  onClose,
}: {
  selection: DrawerSelection;
  onClose: () => void;
}) {
  const [load, setLoad] = useState<ProductLoad | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad(null);
    void loadProduct(selection.productId).then((result) => {
      if (!cancelled) setLoad(result);
    });
    return () => {
      cancelled = true;
    };
  }, [selection.productId]);

  // Fokus masuk ke panel saat dibuka dan kembali ke pembukanya saat ditutup.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => opener?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  return (
    <div className={styles.root}>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={load?.kind === 'ok' ? load.product.name : COPY.kicker}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <SnoutyAvatar mood="wink" size={34} />
            <div>
              <div className={styles.kicker}>{COPY.kicker}</div>
              <div className={styles.subline}>{COPY.subline}</div>
            </div>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={COPY.close}>
            ×
          </button>
        </header>

        <div className={styles.body} aria-live="polite" aria-busy={load === null}>
          {load === null && <p className={styles.status}>{COPY.loading}</p>}
          {load?.kind === 'not-found' && <p className={styles.status}>{COPY.notFound}</p>}
          {load?.kind === 'error' && <p className={styles.status}>{COPY.error}</p>}
          {load?.kind === 'ok' && (
            <ProductBody load={load} selection={selection} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

function ProductBody({
  load,
  selection,
  onClose,
}: {
  load: Extract<ProductLoad, { kind: 'ok' }>;
  selection: DrawerSelection;
  onClose: () => void;
}) {
  const { product, fittings, documents } = load;

  return (
    <>
      <div className={styles.hero}>
        {product.imageUrl ? (
          // Gambar katalog dari host mana pun yang dipakai impor — bukan aset Next.
          <img className={styles.image} src={product.imageUrl} alt={product.name} />
        ) : (
          <div className={styles.imagePlaceholder} aria-hidden="true">
            {COPY.imagePlaceholder}
          </div>
        )}
        <div className={styles.heroText}>
          <div className={styles.category}>{product.category}</div>
          <h2 className={styles.name}>{product.name}</h2>
          <p className={styles.description}>{product.description}</p>
          {selection.size !== undefined && selection.matchState !== undefined && (
            <span className={styles.usedTag}>
              {SOLUTION_COPY.matchStateLabel[selection.matchState]} · {selection.size}
            </span>
          )}
        </div>
      </div>

      {product.sizes.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{COPY.sizesTitle}</h3>
          <ul className={styles.sizes}>
            {product.sizes.map((size) => (
              <li
                key={size}
                className={[styles.size, size === selection.size ? styles.sizeCurrent : ''].join(
                  ' ',
                )}
                aria-current={size === selection.size ? 'true' : undefined}
              >
                {size}
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className={styles.specGrid}>
        {SPEC_ORDER.map((key) => (
          <SpecRow key={key} label={COPY.specLabels[key]} spec={product[key]} />
        ))}
      </dl>

      {documents.length > 0 && (
        <section className={styles.section} data-needs-design="true">
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>{COPY.documentsTitle}</h3>
            <span className={styles.needsDesign}>{COPY.documentsNeedsDesign}</span>
          </div>
          <ul className={styles.documents}>
            {documents.map((document) => (
              <li key={`${document.url}#${document.page ?? ''}`}>
                <a
                  className={styles.document}
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.documentTitle}>{document.title}</span>
                  <span className={styles.documentMeta}>
                    {COPY.openDocument}
                    {document.page !== null && ` · hal. ${document.page}`}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fittings.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{COPY.fittingsTitle}</h3>
          <ul className={styles.fittings}>
            {fittings.map((fitting) => (
              <li key={fitting.productId} className={styles.fitting}>
                <div className={styles.fittingThumb} aria-hidden="true" />
                <span className={styles.fittingName}>{fitting.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className={styles.footer}>
        <div>
          <div className={styles.sourceLabel}>{COPY.sourceLabel}</div>
          <div className={styles.source}>
            {sourceLine(product.sourceDocument, product.sourcePage)}
          </div>
        </div>
        <button type="button" className={styles.back} onClick={onClose}>
          {COPY.back}
        </button>
      </footer>
    </>
  );
}

function SpecRow({ label, spec }: { label: string; spec: SpecValue }) {
  return (
    <div className={styles.specCell}>
      <dt className={styles.specLabel}>{label}</dt>
      {specHasValue(spec) ? (
        <dd className={styles.specValue}>
          {spec.value}
          {spec.sourceDocument !== undefined && spec.sourcePage !== undefined && (
            <span className={styles.specSource}>
              {specSourceLine(spec.sourceDocument, spec.sourcePage)}
            </span>
          )}
        </dd>
      ) : (
        <dd className={[styles.specValue, styles.specMissing].join(' ')}>{COPY.specMissing}</dd>
      )}
    </div>
  );
}
