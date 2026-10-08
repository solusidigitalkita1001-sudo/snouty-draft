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

  // Port baku docker-compose adalah 6380, bukan 6379 — lihat docker-compose.yml.
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6380'),

  /**
   * RabbitMQ. Port baku docker-compose adalah 5673, bukan 5672 — host ini menjalankan
   * beberapa layanan sekaligus dan port standar sudah terpakai.
   *
   * Kegagalan antrean tidak menjatuhkan permintaan pengguna (lihat `JobPublisher`), jadi
   * nilai baku yang salah muncul sebagai job yang tidak terkirim dan tercatat — bukan
   * sebagai permintaan yang gagal.
   */
  RABBITMQ_URL: z.string().min(1).default('amqp://guest:guest@127.0.0.1:5673'),

  /**
   * Rahasia JWT tanpa nilai baku, **sengaja**.
   *
   * Nilai baku untuk rahasia adalah nilai baku yang suatu hari berjalan di
   * produksi. Proses menolak start tanpa keduanya, dan itu kegagalan yang benar:
   * lebih baik gagal keras saat deploy daripada menandatangani token dengan
   * rahasia yang sudah ada di repositori mana pun (docs/SECURITY.md §10).
   *
   * Panjang minimum 32 karakter karena rahasia pendek membuat HMAC-nya bisa
   * ditebak, bukan karena angka 32 punya arti khusus.
   */
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  /** Detik. Access token berumur pendek; umur panjang membuat pencabutan tak berarti. */
  JWT_ACCESS_TTL: z.coerce.number().int().positive().max(3600).default(900),
  /** Detik. 30 hari — dirotasi setiap pemakaian, jadi umur panjang tidak berarti sesi abadi. */
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
  /** Detik. 24 jam, sesuai TTL snapshot kebutuhan di Redis. */
  GUEST_SESSION_TTL: z.coerce.number().int().positive().default(86_400),

  /**
   * Token layanan `apps/worker` untuk rute `/internal/reports/*` (OQ-49). Nilai yang sama
   * dipasang di env worker. Opsional: tanpa ini worker tidak bisa mengambil halaman cetak
   * dan PDF laporan tidak dibuat — tetapi API tetap boot, karena chat dan analisis tidak
   * bergantung padanya. Panjang minimum sama dengan rahasia JWT, alasannya sama.
   */
  WORKER_INTERNAL_TOKEN: z.string().min(32).optional(),

  /**
   * Versi kebijakan privasi yang disimpan di setiap baris consent (SPEC §30b).
   *
   * `v0-draft` adalah usulan default OQ-12: teksnya belum ada, tetapi catatan
   * consent tidak boleh menunggu teks — persetujuan tanpa versi tidak bisa dijawab
   * saat seseorang bertanya "disetujui atas dasar apa?".
   */
  POLICY_VERSION: z.string().min(1).default('v0-draft'),

  /**
   * Integrasi LLM — semuanya OPSIONAL. Tanpa `OPENROUTER_API_KEY`, adapter live
   * tidak terdaftar dan sistem memakai jalur deterministik/klarifikasi; ini yang
   * membuat seluruh Context Engine bisa dikembangkan dan diuji tanpa kunci maupun
   * biaya (docs/AI_BEHAVIOR.md). ID model TIDAK PERNAH ditulis di kode — routing
   * memetakan tingkat ke salah satu dari tiga variabel ini (docs/AI_BEHAVIOR.md).
   */
  /**
   * Harga (OQ-03) — **baku nonaktif**. Saat nonaktif, kolom harga dan blok total tidak
   * dirender sama sekali; menampilkan Rp 0 akan terbaca sebagai "gratis".
   */
  PRICING_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  TAX_RATE_PERCENT: z.coerce.number().int().min(0).max(100).default(11),

  /** Akar penyimpanan berkas (PDF laporan dari worker). Tanpa ini, unduhan menjawab 503. */
  STORAGE_PATH: z.string().min(1).optional(),
  /** Batas ukuran lampiran denah (MB) — selaras dengan `client_max_body_size` Nginx (12m). */
  UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(50).default(10),
  /** Retensi lampiran denah (hari) — OQ-13, docs/SECURITY.md §7. */
  UPLOAD_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(180),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  LLM_MODEL_FAST: z.string().min(1).optional(),
  LLM_MODEL_BALANCED: z.string().min(1).optional(),
  LLM_MODEL_STRONG: z.string().min(1).optional(),
  /**
   * Model EMBEDDING untuk pemahaman pertanyaan (modul `understanding`, P16-11): contoh kalimat
   * di `data/understanding/` disandikan dan dibandingkan dengan pesan pengguna. Dilayani endpoint
   * `/embeddings` yang sama basis URL-nya (Ollama: `bge-m3`). Tanpa ini, setiap pesan yang
   * tidak terbaca parser nilai jatuh ke model generatif — jujur, tetapi lambat di CPU.
   */
  LLM_MODEL_EMBEDDING: z.string().min(1).optional(),
  /**
   * Basis URL KHUSUS embedding. Kosong = sama dengan `OPENROUTER_BASE_URL`. Diisi saat model chat
   * pindah ke penyedia hosted (OpenRouter/Groq/Gemini) sementara embedding tetap di Ollama lokal
   * (`http://ollama:11434/v1`): contoh pemahaman tersandi bge-m3, dan penyedia chat belum tentu
   * melayani `/embeddings` dengan model yang sama.
   */
  EMBEDDING_BASE_URL: z.string().url().optional(),
  /** Kunci untuk `EMBEDDING_BASE_URL`; Ollama tidak memerlukannya. */
  EMBEDDING_API_KEY: z.string().min(1).optional(),
  /** Folder berkas contoh pemahaman; baku: `data/understanding` di akar repo (dicari ke atas). */
  UNDERSTANDING_DATA_DIR: z.string().min(1).optional(),
  /**
   * Folder cache vektor contoh; baku: `<tmp>/snouty-understanding`. Di produksi diarahkan ke volume
   * (compose) supaya rilis berikutnya tidak menyandikan ulang ±1.300 contoh — di CPU server itu
   * ±8 menit, dan selama itu pesan pertama menunggu.
   */
  UNDERSTANDING_CACHE_DIR: z.string().min(1).optional(),
  /**
   * Latensi (2026-10-06, qwen2.5:7b di CPU: 10–60 detik per panggilan).
   * - `LLM_FAQ_REWRITE`: biarkan model merangkai ulang jawaban FAQ produk. Baku nonaktif:
   *   teks deterministiknya sudah utuh, dan model 7B hampir selalu ditolak pagar struktur —
   *   satu menit untuk hasil yang dibuang.
   * - `LLM_REPLY_TIMEOUT_MS`: batas tunggu balasan percakapan (sapaan, komplain); lewat itu
   *   panggilan dibatalkan dan teks tetap dipakai. Pembatalan sungguhan (AbortSignal), supaya
   *   antrean Ollama yang serial tidak tersumbat generasi yang sudah tidak ditunggu.
   */
  LLM_FAQ_REWRITE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  LLM_REPLY_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(10_000),
  /**
   * Diet panggilan model (2026-10-07, qwen2.5:7b di CPU server: 23 tok/s prompt, <1 tok/s
   * jawaban). Semuanya baku nonaktif; nyalakan hanya dengan model yang cepat (GPU/berbayar):
   * - `LLM_CHAT_REPLY`: sapaan/di luar topik/pembuka ditulis model (nonaktif: teks tetap, 0 s).
   * - `LLM_STRUCTURED_RETRY`: percobaan kedua bila JSON terstruktur tidak valid (nonaktif:
   *   langsung fakta tersurat dari teks + klarifikasi).
   * - `LLM_SOLUTION_PROSE`: headline/body solusi bangunan ditulis model (nonaktif: templat).
   */
  LLM_CHAT_REPLY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  LLM_STRUCTURED_RETRY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  LLM_SOLUTION_PROSE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /**
   * Batas tunggu SETIAP panggilan terstruktur (intent, ekstraksi, parse produk, judul). Diukur
   * 2026-10-06: satu percobaan ulang ekstraksi di laptop yang kehabisan RAM memakan 524 detik.
   * Lewat batas → dibatalkan; giliran jatuh ke jalur jujurnya (LLM_UNAVAILABLE / klarifikasi),
   * bukan menggantung berminit-menit.
   */
  LLM_CALL_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(900_000).default(90_000),
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
