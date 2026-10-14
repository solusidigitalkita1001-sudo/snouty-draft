/**
 * Ilustrasi SNOUTY (DD-01): satu sprite SVG per halaman, dipakai lewat `<use href>`.
 * Gambarnya ada di `@snouty/ui/illustrations` (dibuat dari mockup yang disetujui pemilik), warnanya
 * token tema — jadi terang dan gelap ikut tanpa gambar kedua.
 */

import {
  productHref,
  sceneHref,
  PRODUCT_VIEWBOX,
  SCENE_VIEWBOX,
  type ProductIllustration,
  type SceneIllustration,
} from '@snouty/ui/illustrations';
import type { ProductColors } from '@snouty/ui/product-visual';

export { IllustrationSprite } from './illustration-sprite';

/** Gambar kebutuhan/pilihan. Tanpa `label` gambarnya dekoratif (teks di sebelahnya sudah cukup). */
export function SceneImage({
  name,
  label,
  className,
}: {
  name: SceneIllustration;
  label?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <svg
      viewBox={SCENE_VIEWBOX}
      className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <use href={sceneHref(name)} />
    </svg>
  );
}

export function ProductImage({
  name,
  colors,
  label,
  className,
}: {
  name: ProductIllustration;
  colors: ProductColors;
  label?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <svg
      viewBox={PRODUCT_VIEWBOX}
      className={className}
      style={
        {
          '--il-pc': colors.body,
          '--il-pc2': colors.line,
          '--il-pc3': colors.text,
        } as React.CSSProperties
      }
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <use href={productHref(name)} />
    </svg>
  );
}
