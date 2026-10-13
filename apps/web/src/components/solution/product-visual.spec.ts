/** P17-06: gambar kartu produk — foto pralon.com untuk AW/VP/Jacking, gambar jenis untuk lainnya. */
import { describe, expect, it } from 'vitest';
import { productVisual } from '@snouty/ui/product-visual';

describe('productVisual', () => {
  it('foto asli hanya untuk keluarga yang fotonya memang keluarga itu', () => {
    expect(productVisual({ family: 'PVC AW', kind: 'pipe' })).toEqual({
      kind: 'photo',
      file: 'pvc-aw.jpg',
    });
    expect(productVisual({ family: 'PVC VP', kind: 'pipe' })).toMatchObject({ kind: 'photo' });
    // PVC D tidak memakai foto AW (keputusan pemilik: foto D diminta ke Pralon, OQ-62).
    expect(productVisual({ family: 'PVC D', kind: 'pipe' })).toMatchObject({
      kind: 'drawing',
      name: 'pipe',
    });
  });

  it('fitting: jenis dari kategori katalog; tee dua ukuran = tee reduksi', () => {
    const name = (category: string, size = '1"') =>
      (
        productVisual({ family: 'FITTING PVC', category, size, kind: 'fitting' }) as {
          name?: string;
        } | null
      )?.name;
    expect(name('FITTING · TEE')).toBe('tee');
    expect(name('FITTING · TEE', '1" × 3/4"')).toBe('rtee');
    expect(name('FITTING · ELBOW 90°')).toBe('elbow');
    expect(name('FITTING · BEND 45°')).toBe('elbow');
    expect(name('FITTING · ELBOW REDUCER')).toBe('elbow');
    expect(name('FITTING · RED SOCKET')).toBe('socket');
    expect(name('FITTING · CAP')).toBe('cap');
    expect(name('FITTING · CLEAN OUT CAP')).toBe('cleanout');
    expect(name('FITTING · LONG TY')).toBe('y');
    expect(name('FITTING · Y')).toBe('y');
  });

  it('kategori tanpa gambar jenisnya tidak diberi gambar', () => {
    expect(
      productVisual({
        family: 'FITTING PVC',
        category: 'FITTING · ALL FLANGE REDUCER',
        kind: 'fitting',
      }),
    ).toBeNull();
    expect(productVisual({ kind: 'fitting' })).toBeNull();
  });
});
