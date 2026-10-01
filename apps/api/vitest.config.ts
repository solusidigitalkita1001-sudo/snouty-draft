import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      /**
       * Tes memakai **sumber** `@snouty/shared-types`, bukan `dist`-nya.
       *
       * `main` paket itu menunjuk ke `dist` karena API yang sudah dibangun
       * memuatnya saat runtime. Tanpa alias ini, `vitest` ikut memuat `dist` —
       * dan `dist` yang tertinggal satu edit akan membuat tes gagal dengan pesan
       * yang menyesatkan ("specHasValue is not a function") padahal fungsinya ada
       * di sumber. Kegagalan itu sudah terjadi sekali; mengandalkan ingatan untuk
       * menjalankan build lebih dulu bukan perbaikan.
       */
      '@snouty/shared-types': fileURLToPath(
        new URL('../../packages/shared-types/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
