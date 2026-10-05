/**
 * Kartu produk dari jawaban pengetahuan produk (`AssistantCard` kind `product`).
 *
 * Bukan kartu layar 07: produk di sini tidak "dipakai di solusi" mana pun, jadi tidak ada
 * bar peran maupun label keadaan pencocokan — yang ditampilkan nama, SKU, provenance data
 * katalognya, dan jalan ke drawer detail (layar 10). Tidak ada di prototipe sebagai layar
 * sendiri; dibangun dari pola kartu produk yang ada, menunggu desain (OQ-21).
 */
import type { ProductCardDto } from '@snouty/shared-types';

import { ProvenanceTag } from '../solution/provenance-tag';
import { CHAT_COPY as COPY } from './chat-copy';
import styles from './chat-workspace.module.css';

export function ProductLookupCards({
  products,
  onOpen,
}: {
  products: readonly ProductCardDto[];
  onOpen: (product: ProductCardDto) => void;
}) {
  if (products.length === 0) return null;
  return (
    <section
      className={styles.lookupCards}
      data-needs-design="true"
      aria-label={COPY.productCards.title}
    >
      <span className={styles.lookupTitle}>{COPY.productCards.title}</span>
      <div className={styles.lookupGrid}>
        {products.map((product) => (
          <button
            key={product.productId}
            type="button"
            className={styles.lookupCard}
            onClick={() => onOpen(product)}
          >
            <span className={styles.lookupSku}>{product.sku}</span>
            <span className={styles.lookupName}>{product.name}</span>
            <ProvenanceTag provenance={product.provenance} />
            <span className={styles.lookupOpen}>{COPY.productCards.open}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
