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
import { chatCopy } from './chat-copy';
import { useLocale } from '../locale';
import styles from './chat-workspace.module.css';

/** Teks UI mengikuti bahasa yang dipilih (Fase 15). */
/**
 * SKU dari ekspor ERP (`__export__.product_product_123`, `product.0_S_01_…`) adalah ID internal,
 * bukan kode yang dikenal pelanggan — tidak ditampilkan sampai kolom SKU sebenarnya tersedia (OQ-55).
 */
export function isCustomerSku(sku: string): boolean {
  return !/^(__export__\.|product\.)/i.test(sku) && !/\.product_product_\d+$/i.test(sku);
}

function useChatCopy() {
  return chatCopy(useLocale().locale);
}

export function ProductLookupCards({
  products,
  onOpen,
}: {
  products: readonly ProductCardDto[];
  onOpen: (product: ProductCardDto) => void;
}) {
  const COPY = useChatCopy();
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
            {isCustomerSku(product.sku) && <span className={styles.lookupSku}>{product.sku}</span>}
            <span className={styles.lookupName}>{product.name}</span>
            <ProvenanceTag provenance={product.provenance} />
            <span className={styles.lookupOpen}>{COPY.productCards.open}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
