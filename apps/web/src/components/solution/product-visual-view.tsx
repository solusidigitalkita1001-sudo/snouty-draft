/** Gambar produk di kartu dan BOQ: foto pralon.com bila ada, selain itu gambar jenis SNOUTY. */

import { ProductImage } from '../illustration/illustration';
import type { ProductVisual } from './product-visual';

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
    // eslint-disable-next-line @next/next/no-img-element -- foto statis kecil dari /public, tanpa optimasi
    return <img src={visual.src} alt={label} className={className} loading="lazy" />;
  }
  return (
    <ProductImage name={visual.name} colors={visual.colors} label={label} className={className} />
  );
}
