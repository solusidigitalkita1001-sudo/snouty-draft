/**
 * Drawer produk (layar 10). Yang dipaku di sini adalah janji, bukan tata letak:
 *   - spesifikasi `UNAVAILABLE` tidak pernah merender nilai — hanya "Lihat dokumen teknis";
 *   - baris sumber katalog selalu ada (PRODUCT_KNOWLEDGE.md);
 *   - tidak ada harga — ini pengetahuan teknis, bukan halaman toko;
 *   - Esc, ×, scrim, dan "Kembali ke solusi" semuanya menutup.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { Product } from '@snouty/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductLoad } from './product-api';
import { ProductDrawer, type DrawerSelection } from './product-drawer';

const loadProduct = vi.fn<(id: string) => Promise<ProductLoad>>();
vi.mock('./product-api', () => ({ loadProduct: (id: string) => loadProduct(id) }));

const PRODUCT: Product = {
  id: '01JBPRODUCT000000000000001',
  sku: 'AW-075',
  name: 'Pralon PVC AW',
  family: 'PVC AW',
  category: 'PIPA AIR BERSIH · SNI',
  description: 'Pipa PVC untuk air bersih bertekanan.',
  status: 'active',
  sizes: ['1/2"', '3/4"', '1"'],
  material: { provenance: 'VERIFIED', value: 'PVC-U' },
  standard: {
    provenance: 'VERIFIED',
    value: 'SNI 06-0084',
    sourceDocument: 'Datasheet PVC AW',
    sourcePage: 3,
  },
  pressureClass: { provenance: 'UNAVAILABLE', value: null },
  rodLength: { provenance: 'VERIFIED', value: '4 m' },
  jointType: { provenance: 'VERIFIED', value: 'Lem (solvent cement)' },
  application: { provenance: 'VERIFIED', value: 'Air bersih' },
  sourceDocument: 'Katalog produk Pralon 2026',
  sourcePage: 14,
  catalogVersionId: '01JBCATALOG0000000000000001',
  imageUrl: null,
};

const SELECTION: DrawerSelection = {
  productId: PRODUCT.id,
  size: '3/4"',
  matchState: 'VERIFIED_SELECTED',
};

function ok(): Extract<ProductLoad, { kind: 'ok' }> {
  return {
    kind: 'ok',
    product: PRODUCT,
    fittings: [{ productId: '01JBFITTING000000000000001', name: 'Tee PVC 3/4"', kind: 'tee' }],
    documents: [{ title: 'Datasheet PVC AW', url: 'https://example.invalid/aw.pdf', page: 7 }],
  };
}

beforeEach(() => {
  loadProduct.mockReset();
});

describe('ProductDrawer', () => {
  it('merender "Lihat dokumen teknis" untuk spesifikasi UNAVAILABLE, tanpa nilai', async () => {
    loadProduct.mockResolvedValue(ok());
    render(<ProductDrawer selection={SELECTION} onClose={() => {}} />);

    const label = await screen.findByText('Tekanan kerja');
    const cell = label.closest('div')!;
    expect(cell.textContent).toBe('Tekanan kerjaLihat dokumen teknis');
  });

  it('menampilkan sitasi hanya untuk nilai yang berasal dari dokumen', async () => {
    loadProduct.mockResolvedValue(ok());
    render(<ProductDrawer selection={SELECTION} onClose={() => {}} />);

    expect(await screen.findByText('Sumber: Datasheet PVC AW hal. 3')).toBeTruthy();
    expect(screen.getAllByText(/^Sumber: /)).toHaveLength(1);
  });

  it('selalu menampilkan baris sumber katalog', async () => {
    loadProduct.mockResolvedValue(ok());
    render(<ProductDrawer selection={SELECTION} onClose={() => {}} />);

    expect(await screen.findByText('Katalog produk Pralon 2026 · hal. 14')).toBeTruthy();
  });

  it('menyorot ukuran yang dipakai solusi', async () => {
    loadProduct.mockResolvedValue(ok());
    render(<ProductDrawer selection={SELECTION} onClose={() => {}} />);

    const current = await screen.findByText('3/4"', { selector: 'li' });
    expect(current.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('1"', { selector: 'li' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('DIPAKAI DI SOLUSI INI · 3/4"')).toBeTruthy();
  });

  it('menampilkan fitting dari tabel kompatibilitas', async () => {
    loadProduct.mockResolvedValue(ok());
    render(<ProductDrawer selection={SELECTION} onClose={() => {}} />);

    expect(await screen.findByText('Tee PVC 3/4"')).toBeTruthy();
  });

  it('menawarkan dokumen teknis sebagai tautan yang dibuka di tab baru, dengan halamannya', async () => {
    loadProduct.mockResolvedValue(ok());
    render(<ProductDrawer selection={SELECTION} onClose={() => {}} />);

    const link = (await screen.findByText('Datasheet PVC AW')).closest('a')!;
    expect(link.getAttribute('href')).toBe('https://example.invalid/aw.pdf');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.textContent).toContain('Buka dokumen teknis · hal. 7');
  });

  it('tanpa dokumen, bagian dokumen tidak dirender sama sekali', async () => {
    loadProduct.mockResolvedValue({ ...ok(), documents: [] });
    render(<ProductDrawer selection={SELECTION} onClose={() => {}} />);

    await screen.findByText('Pralon PVC AW');
    expect(screen.queryByText('DOKUMEN TEKNIS')).toBeNull();
  });

  it('tidak menampilkan harga', async () => {
    loadProduct.mockResolvedValue(ok());
    const { container } = render(<ProductDrawer selection={SELECTION} onClose={() => {}} />);

    await screen.findByText('Pralon PVC AW');
    expect(container.textContent).not.toMatch(/Rp|harga/i);
  });

  it('Esc, ×, dan "Kembali ke solusi" menutup drawer', async () => {
    loadProduct.mockResolvedValue(ok());
    const onClose = vi.fn();
    render(<ProductDrawer selection={SELECTION} onClose={onClose} />);
    await screen.findByText('Pralon PVC AW');

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Tutup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kembali ke solusi' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('memberi tahu bila produk tidak ada di katalog aktif', async () => {
    loadProduct.mockResolvedValue({ kind: 'not-found' });
    render(<ProductDrawer selection={SELECTION} onClose={() => {}} />);

    expect(await screen.findByText('Produk ini tidak ada di katalog aktif.')).toBeTruthy();
  });
});
