/** Gambar produk di kartu dan BOQ: foto pralon.com bila ada, selain itu gambar jenis SNOUTY. */

import { ProductImage } from '../illustration/illustration';
import type { ProductVisual } from '@snouty/ui/product-visual';

export function ProductVisualView({
  visual,
  label,
  className,
}: {
  visual: ProductVisual;
  label: string;
  className?: string | undefined;
}) {
  if (visual.kind === 'photo') {
    // Foto statis kecil dari /public: <img> biasa, tanpa optimasi gambar Next.
    return (
      <img src={`/products/${visual.file}`} alt={label} className={className} loading="lazy" />
    );
  }
  return (
    <ProductImage name={visual.name} colors={visual.colors} label={label} className={className} />
  );
}
