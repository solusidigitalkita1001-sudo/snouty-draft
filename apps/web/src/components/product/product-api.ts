/**
 * Klien katalog untuk drawer produk. Rute katalog terbuka untuk tamu (`PRODUCT_QA`),
 * tetapi header auth tetap dikirim supaya pola panggilannya sama dengan klien lain.
 */

import type { CompatibleFitting, Product, ProductDocument } from '@snouty/shared-types';

import { authHeaders } from '../auth/session';

const BASE = '/api/v1';

export type ProductLoad =
  | {
      readonly kind: 'ok';
      readonly product: Product;
      readonly fittings: readonly CompatibleFitting[];
      readonly documents: readonly ProductDocument[];
    }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'error' };

/**
 * Produk, fitting sepadan, dan dokumen teknisnya, diambil paralel. Fitting atau dokumen
 * yang gagal dimuat tidak menggagalkan drawer: spesifikasi tetap berguna tanpa keduanya.
 */
export async function loadProduct(productId: string): Promise<ProductLoad> {
  const init = { credentials: 'include' as const, headers: authHeaders() };
  const base = `${BASE}/products/${encodeURIComponent(productId)}`;
  try {
    const [productRes, fittingsRes, documentsRes] = await Promise.all([
      fetch(base, init),
      fetch(`${base}/compatible`, init),
      fetch(`${base}/documents`, init),
    ]);
    if (productRes.status === 404) return { kind: 'not-found' };
    if (!productRes.ok) return { kind: 'error' };

    const product = (await productRes.json()) as Product;
    return {
      kind: 'ok',
      product,
      fittings: await itemsOf<CompatibleFitting>(fittingsRes),
      documents: await itemsOf<ProductDocument>(documentsRes),
    };
  } catch {
    return { kind: 'error' };
  }
}

async function itemsOf<T>(response: Response): Promise<readonly T[]> {
  if (!response.ok) return [];
  return ((await response.json()) as { items: T[] }).items;
}
