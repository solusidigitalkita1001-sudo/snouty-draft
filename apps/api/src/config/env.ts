import { z } from 'zod';

/**
 * Konfigurasi hanya dari environment, divalidasi saat boot.
 * Proses menolak start bila config wajib hilang — lebih baik gagal keras saat
 * deploy daripada gagal halus saat pengguna pertama datang
 * (docs/ARCHITECTURE.md §10).
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_DATABASE: z.string().min(1),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Konfigurasi environment tidak valid:\n${issues}`);
  }
  return parsed.data;
}
