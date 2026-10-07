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
      // Parameter berawalan `_` memang sengaja tidak dipakai — lazimnya pada
      // implementasi port yang harus cocok dengan tanda tangan interface-nya.
      // Tanpa pengecualian ini, satu-satunya cara lolos lint adalah menghapus
      // parameternya, dan itu mengubah tanda tangan yang justru harus dipertahankan.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
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
    // Janji paling eksplisit yang dibuat produk: "Data wilayah dipakai untuk analisis
    // kebutuhan pasar, bukan untuk menentukan rekomendasi." Penegakannya struktural —
    // tidak ada jalur impor dari rekomendasi/engineering ke market-intelligence, jadi
    // tidak ada jalur data dari lokasi ke rekomendasi (docs/MARKET_INTELLIGENCE.md §6).
    files: [
      'apps/api/src/modules/recommendation/**/*.ts',
      'apps/api/src/modules/engineering/**/*.ts',
      'apps/api/src/modules/context/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/market-intelligence/**'],
              message:
                'Lokasi tidak boleh punya jalur ke rekomendasi (docs/MARKET_INTELLIGENCE.md §6).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/modules/company-knowledge/**/*.ts'],
    rules: {
      // Pengetahuan perusahaan (Fase 16) membaca ragam produk lewat port `product-catalog`,
      // bukan MySQL, dan tidak pernah menyentuh `ai`: jawabannya fakta terverifikasi milik kode.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/infrastructure/mysql/**',
                'drizzle-orm',
                'drizzle-orm/*',
                'mysql2',
                'mysql2/*',
                '**/modules/ai/**',
              ],
              message:
                'company-knowledge membaca katalog lewat port product-catalog dan tidak memanggil model (docs/ARCHITECTURE.md §7).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/modules/product-knowledge/**/*.ts'],
    rules: {
      // `product-knowledge` membaca katalog lewat port yang diekspor
      // `product-catalog`, bukan lewat MySQL langsung. Dua jalur ke satu tabel akan
      // menyimpang, dan menyimpangnya terlihat sebagai jawaban produk yang berbeda
      // tergantung siapa yang menanyakannya.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/infrastructure/mysql/**',
                'drizzle-orm',
                'drizzle-orm/*',
                'mysql2',
                'mysql2/*',
              ],
              message:
                'product-knowledge membaca katalog lewat port product-catalog, bukan lewat MySQL (docs/ARCHITECTURE.md §7).',
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
    // Skrip CLI: keluaran konsol memang tujuannya.
    files: ['**/*.config.{js,mjs,ts}', '**/scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
