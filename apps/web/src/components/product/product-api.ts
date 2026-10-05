/**
 * Klien katalog untuk drawer produk. Rute katalog terbuka untuk tamu (`PRODUCT_QA`),
 * tetapi header auth tetap dikirim supaya pola panggilannya sama dengan klien lain.
 */

import type { CompatibleFitting, Product } from '@snouty/shared-types';

import { authHeaders } from '../auth/session';

const BASE = '/api/v1';

export type ProductLoad =
  | {
      readonly kind: 'ok';
      readonly product: Product;
      readonly fittings: readonly CompatibleFitting[];
    }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'error' };

/**
 * Produk dan fitting sepadannya, diambil paralel. Fitting yang gagal dimuat tidak
 * menggagalkan drawer: spesifikasi tetap berguna tanpa daftar fitting.
 */
export async function loadProduct(productId: string): Promise<ProductLoad> {
  const init = { credentials: 'include' as const, headers: authHeaders() };
  try {
    const [productRes, fittingsRes] = await Promise.all([
      fetch(`${BASE}/products/${encodeURIComponent(productId)}`, init),
      fetch(`${BASE}/products/${encodeURIComponent(productId)}/compatible`, init),
    ]);
    if (productRes.status === 404) return { kind: 'not-found' };
    if (!productRes.ok) return { kind: 'error' };

    const product = (await productRes.json()) as Product;
    const fittings = fittingsRes.ok
      ? ((await fittingsRes.json()) as { items: CompatibleFitting[] }).items
      : [];
    return { kind: 'ok', product, fittings };
  } catch {
    return { kind: 'error' };
  }
}
