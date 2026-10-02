import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Tes komponen. docs/EVALUATION.md (piramida, lapisan "Komponen").
 *
 * Yang diuji di lapisan ini adalah hal-hal yang hanya ada di rendering: provenance yang
 * benar, catatan wajib yang tidak bisa disembunyikan, dan mood mascot. Logika bisnis
 * tidak diuji di sini — ia tidak hidup di komponen.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Alasan sama seperti di apps/api: tes memakai SUMBER paket, bukan `dist`-nya,
      // supaya `dist` yang tertinggal satu edit tidak menyesatkan tes.
      '@snouty/shared-types': fileURLToPath(
        new URL('../../packages/shared-types/src/index.ts', import.meta.url),
      ),
      '@snouty/engineering': fileURLToPath(
        new URL('../../packages/engineering/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.tsx', 'src/**/*.spec.ts'],
    css: true,
    /**
     * Transform jsdom + React memakan ~80% waktu dan diulang setiap kali tanpa ini.
     * Cache-nya mengubah 150 detik menjadi beberapa detik pada jalanan berikutnya —
     * dan suite yang lambat adalah suite yang mulai dilewati orang.
     */
    fsModuleCache: true,
  },
});
