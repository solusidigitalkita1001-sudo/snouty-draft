import { fireEvent, render, screen } from '@testing-library/react';
import type { ProductCardDto } from '@snouty/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { ProductLookupCards, isCustomerSku } from './product-lookup-cards';

const CARD: ProductCardDto = {
  productId: '01JBPRODUCT000000000000001',
  sku: 'AW-075',
  name: 'Pipa PVC AW',
  sizeLabel: null,
  state: 'INFORMATION_UNAVAILABLE',
  provenance: 'UNAVAILABLE',
  sourceDocument: 'Katalog 2026',
  sourcePage: 14,
  imageUrl: null,
};

describe('ProductLookupCards', () => {
  it('merender nama, SKU, dan provenance sebagai teks — tidak pernah label "dipakai di solusi"', () => {
    render(<ProductLookupCards products={[CARD]} onOpen={() => {}} />);

    expect(screen.getByText('Pipa PVC AW')).toBeTruthy();
    expect(screen.getByText('AW-075')).toBeTruthy();
    expect(screen.getByText('LIHAT DOKUMEN TEKNIS')).toBeTruthy();
    expect(screen.queryByText(/DIPAKAI DI SOLUSI/)).toBeNull();
  });

  it('SKU ekspor ERP (ID internal Odoo) tidak ditampilkan — nama tetap (OQ-55)', () => {
    render(
      <ProductLookupCards
        products={[{ ...CARD, sku: '__export__.product_product_10197' }]}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Pipa PVC AW')).toBeTruthy();
    expect(screen.queryByText(/__export__/)).toBeNull();
    expect(isCustomerSku('product.0_S_01_011_016004_00')).toBe(false);
    expect(isCustomerSku('AW-075')).toBe(true);
  });

  it('mengklik kartu membuka produknya', () => {
    const onOpen = vi.fn();
    render(<ProductLookupCards products={[CARD]} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: /Pipa PVC AW/ }));
    expect(onOpen).toHaveBeenCalledWith(CARD);
  });

  it('tanpa produk tidak merender apa pun', () => {
    const { container } = render(<ProductLookupCards products={[]} onOpen={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});
