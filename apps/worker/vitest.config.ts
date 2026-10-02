import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Alasan sama seperti apps/api: tes memakai SUMBER paket, bukan `dist`-nya.
      '@snouty/jobs': fileURLToPath(new URL('../../packages/jobs/src/index.ts', import.meta.url)),
      '@snouty/shared-types': fileURLToPath(
        new URL('../../packages/shared-types/src/index.ts', import.meta.url),
      ),
    },
  },
  test: { environment: 'node', include: ['src/**/*.spec.ts'] },
});
