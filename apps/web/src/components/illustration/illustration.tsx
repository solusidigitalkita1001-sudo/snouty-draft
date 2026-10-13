/**
 * Ilustrasi SNOUTY (DD-01): satu sprite SVG per halaman, dipakai lewat `<use href>`.
 * Gambarnya ada di `@snouty/ui/illustrations` (dibuat dari mockup yang disetujui pemilik), warnanya
 * token tema — jadi terang dan gelap ikut tanpa gambar kedua.
 */

import {
  illustrationSpriteContent,
  productHref,
  sceneHref,
  PRODUCT_VIEWBOX,
  SCENE_VIEWBOX,
  type ProductIllustration,
  type SceneIllustration,
} from '@snouty/ui/illustrations';

/** Dipasang sekali di layout. Isinya string statis milik kita, bukan masukan pengguna. */
export function IllustrationSprite() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: 'absolute' }}
      dangerouslySetInnerHTML={{ __html: illustrationSpriteContent() }}
    />
  );
}

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

/** Warna gambar produk: badan, garis, tulisan. */
export interface ProductColors {
  readonly body: string;
  readonly line: string;
  readonly text: string;
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
