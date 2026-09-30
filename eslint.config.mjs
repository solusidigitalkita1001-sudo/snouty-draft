// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** Warna hanya boleh datang dari token packages/ui (docs/DESIGN_IMPLEMENTATION.md §3). */
const HEX_COLOR = String.raw`#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b`;

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      'design-input/**',
      'docs/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,

  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // docs/CODING_STANDARDS.md §5–§6
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },

  // ── Batas arsitektur (docs/ARCHITECTURE.md §7) ─────────────────────────────
  // Ditegakkan lint, bukan kesepakatan lisan. Aturan bertambah seiring modul
  // nyata muncul di Fase 3+; tiga yang di bawah sudah bisa ditegakkan sekarang.
  {
    files: ['packages/engineering/**/*.ts'],
    rules: {
      // SPEC §25: perhitungan teknik TIDAK PERNAH memanggil LLM.
      // Paket ini juga tidak punya dependensi runtime sama sekali —
      // lihat scripts/check-engineering-isolation.mjs.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*ai*', '*llm*', '*openrouter*'],
              message: 'Engineering Engine tidak boleh menyentuh LLM (SPEC §25).',
            },
            {
              group: ['*catalog*', '*repository*', '*mysql*', '*redis*'],
              message: 'Engineering Engine harus murni: tanpa I/O.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/modules/policy/**/*.ts'],
    rules: {
      // Policy wajib leaf: tanpa I/O, supaya setiap keputusan adalah fungsi murni.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/shared/database/**', '**/shared/redis/**'],
              message: 'Policy Engine wajib leaf tanpa I/O (docs/POLICY.md §1).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'apps/api/**/*.ts'],
    ignores: ['packages/ui/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${HEX_COLOR}/]`,
          message:
            'Jangan tulis hex mentah. Pakai token dari packages/ui (docs/DESIGN_IMPLEMENTATION.md §3).',
        },
        {
          selector: `TemplateElement[value.raw=/${HEX_COLOR}/]`,
          message:
            'Jangan tulis hex mentah. Pakai token dari packages/ui (docs/DESIGN_IMPLEMENTATION.md §3).',
        },
      ],
    },
  },

  {
    // NestJS memakai emitDecoratorMetadata: kelas yang muncul di posisi tipe pada
    // konstruktor tetap dibutuhkan sebagai NILAI saat runtime untuk resolusi DI.
    // Mengubahnya menjadi `import type` akan mematikan injeksi dengan galat yang
    // membingungkan, jadi aturan ini dimatikan di sini — bukan karena longgar,
    // tetapi karena di konteks ini ia justru menyarankan bug.
    files: ['apps/api/**/*.ts', 'apps/worker/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },

  {
    files: ['**/*.config.{js,mjs,ts}', 'scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
