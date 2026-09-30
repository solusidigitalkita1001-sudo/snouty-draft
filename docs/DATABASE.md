# SNOUTY — Database

Fase 0b · P0b-04 · Terakhir diperbarui 2026-09-30

Server MySQL di `192.168.1.136` adalah **infrastruktur bersama**, bukan milik SNOUTY. Dokumen ini
mengikat: aturan di sini berlaku untuk saya maupun untuk siapa pun yang mengerjakan repositori ini.

---

## 1. Kondisi server (hasil inspeksi read-only P0a-04, 2026-09-30)

| | |
|---|---|
| Versi | MySQL **8.0.46**-0ubuntu0.22.04.4 |
| `sql_mode` | `ONLY_FULL_GROUP_BY, STRICT_TRANS_TABLES, NO_ZERO_IN_DATE, NO_ZERO_DATE, ERROR_FOR_DIVISION_BY_ZERO, NO_ENGINE_SUBSTITUTION` |
| Charset server | `utf8mb4` / `utf8mb4_0900_ai_ci` |
| Database `snouty` | **ada, benar-benar kosong** — 0 tabel, view, routine, trigger, event |
| `snouty_dev`, `snouty_staging` | belum ada |

Database lain yang berbagi host ini:

| Database | Tabel | Ukuran |
|---|---|---|
| `partner_db` | 57 | 39,7 MB |
| `digital_book` | 20 | 26,1 MB |
| `work_order` | 86 | 19,2 MB |
| `wo_dev` | 46 | 15,6 MB |
| `asset` | 37 | 4,7 MB |
| `bagspace` | 12 | 4,1 MB |
| `bagspace_dev` | 43 | 1,1 MB |

Total 301 tabel milik aplikasi lain. Inilah alasan konkret SPEC §17 menyebut server ini "not
disposable": kesalahan di SNOUTY bisa merusak data tim lain.

Dua hal yang bisa langsung dipakai: charset server sudah `utf8mb4` sehingga skema tinggal mengikuti,
dan `STRICT_TRANS_TABLES` sudah aktif sehingga skema boleh mengandalkan semantik ketat (nilai tidak
valid ditolak, bukan dipotong diam-diam).

---

## 2. Lingkungan

Konvensi yang sudah dipakai host ini adalah `<nama>` untuk produksi dengan `<nama>_dev` di
sebelahnya (`work_order`/`wo_dev`, `bagspace`/`bagspace_dev`) — **tidak ada preseden staging** (OQ-35).

| Lingkungan | Database | Host | Status |
|---|---|---|---|
| dev | `snouty_dev` | `192.168.1.136` | belum dibuat — Anda yang membuat |
| staging | `snouty_staging` | `192.168.1.136` | hanya bila Anda mau tier staging (OQ-35) |
| produksi | `snouty` | `192.168.1.136` | ada, kosong |
| CI / tes integrasi | `snouty_test` | **kontainer sekali pakai** | tidak pernah menyentuh host di atas |

Aturan CI ditegakkan di kode, bukan di konfigurasi: bootstrap tes memeriksa `DB_HOST` dan menolak
berjalan bila mengarah ke `192.168.1.136`. Konfigurasi bisa salah, assertion tidak.

Charset & collation setiap database: `utf8mb4` / `utf8mb4_0900_ai_ci`, mengikuti server.

---

## 3. Hak akses — temuan dan usulan

### Kondisi sekarang

Satu-satunya akun non-sistem di host ini adalah `ict` (`ict@%` dan `ict@localhost`), dengan:

```
GRANT ALL PRIVILEGES ON *.* TO `ict`@`%` WITH GRANT OPTION
```

termasuk `DROP`, `SHUTDOWN`, `CREATE USER`, `FILE`, `SUPER`, `BACKUP_ADMIN`,
`SYSTEM_VARIABLES_ADMIN`, atas **seluruh delapan database**. Tidak ada pola least-privilege di server
ini; tampaknya semua aplikasi terhubung sebagai `ict`.

SPEC §17 meminta kebalikannya, dan menyebut secara eksplisit bahwa akun aplikasi tidak boleh memegang
`DROP`. Menjalankan SNOUTY sebagai `ict` berarti satu migration yang salah, satu bug, atau satu `.env`
yang bocor bisa menghapus `partner_db` atau `work_order`. Risiko itu tidak sebanding dengan
kenyamanannya.

### Usulan: tiga akun tersendiri

Naskah di bawah **untuk Anda tinjau dan jalankan sendiri**. Saya tidak membuat user atau memberi grant
di infrastruktur bersama (OQ-34). Ganti setiap `'<…>'` dengan password yang dibangkitkan acak dan
simpan di pengelola kredensial, bukan di repositori ini.

```sql
-- SNOUTY — akun least-privilege. Tinjau sebelum dijalankan.
-- Lingkup sengaja dibatasi ke database SNOUTY saja; tidak ada hak di *.*

-- 1) Akun aplikasi: hanya DML. Tidak ada DDL, tidak ada DROP.
CREATE USER IF NOT EXISTS 'snouty_app'@'%' IDENTIFIED BY '<password-app>';
GRANT SELECT, INSERT, UPDATE, DELETE ON `snouty`.*     TO 'snouty_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON `snouty_dev`.* TO 'snouty_app'@'%';

-- 2) Akun migrasi: DDL terbatas, dipakai hanya saat migration yang sudah disetujui.
--    Sengaja TIDAK diberi DROP; penghapusan objek dilakukan manual dan sadar.
CREATE USER IF NOT EXISTS 'snouty_migrator'@'%' IDENTIFIED BY '<password-migrator>';
GRANT SELECT, INSERT, UPDATE, DELETE,
      CREATE, ALTER, INDEX, REFERENCES      ON `snouty`.*     TO 'snouty_migrator'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE,
      CREATE, ALTER, INDEX, REFERENCES      ON `snouty_dev`.* TO 'snouty_migrator'@'%';

-- 3) Akun baca-saja: inspeksi, dashboard, dan analisis.
CREATE USER IF NOT EXISTS 'snouty_ro'@'%' IDENTIFIED BY '<password-ro>';
GRANT SELECT ON `snouty`.*     TO 'snouty_ro'@'%';
GRANT SELECT ON `snouty_dev`.* TO 'snouty_ro'@'%';

FLUSH PRIVILEGES;

-- Verifikasi:
-- SHOW GRANTS FOR 'snouty_app'@'%';
-- SHOW GRANTS FOR 'snouty_migrator'@'%';
-- SHOW GRANTS FOR 'snouty_ro'@'%';
```

Bila `snouty_staging` jadi dibuat, tambahkan baris `GRANT` yang sama untuknya.

Sebagai pertimbangan terpisah di luar SNOUTY: karena `ict` juga dipakai aplikasi lain, memecah akun
per aplikasi akan menguntungkan seluruh server, bukan hanya proyek ini. Itu keputusan Anda dan tim
infrastruktur.

### Sampai akun itu ada

Pengembangan tetap berjalan sebagai `ict`, dengan kredensial diperlakukan setara produksi:

- hanya di `.env`, yang sudah masuk `.gitignore`;
- tidak pernah ditulis ke log, ke dokumen, atau ke pesan commit;
- tidak pernah menjadi nilai default di `.env.example`;
- **tidak ada migration yang saya jalankan** terhadap host ini dengan akun apa pun tanpa persetujuan
  eksplisit Anda dan backup yang sudah dikonfirmasi.

---

## 4. Prosedur migration

Ini bagian terpenting dokumen. Urutannya tidak boleh dipotong.

```
1. Ubah skema TypeScript
2. pnpm db:generate         → tulis file .sql bernomor ke drizzle/
                              ►►► TIDAK ADA yang menyentuh server ◄◄◄
3. Tulis down.sql secara manual dan commit keduanya
4. Review SQL di dalam pull request — SQL yang dibaca manusia, bukan diff skema
5. pnpm db:test             → terapkan ke kontainer MySQL sekali pakai, jalankan tes integrasi
6. MINTA PERSETUJUAN PEMILIK + konfirmasi backup terbaru
7. MIGRATION_APPROVED=1 pnpm db:apply --env <dev|staging|prod>
```

Langkah 7 sengaja dibuat merepotkan. Perintahnya menolak berjalan bila `MIGRATION_APPROVED` tidak
diset, mencetak SQL lengkap dan host tujuan, lalu meminta konfirmasi ketik ulang nama database. Tidak
ada perintah "migrate dev" yang mengarang dan menerapkan sekaligus.

**Alasan memilih Drizzle** (usulan, `PHASE0_PROPOSAL.md` §4): Prisma membutuhkan *shadow database* —
membuat dan menghapus database di server — untuk `migrate dev`, dan menyediakan `migrate reset`.
TypeORM punya `synchronize: true` yang mengubah skema diam-diam. Di host yang memuat 301 tabel milik
orang lain, alat yang **tidak punya kemampuan** merusak lebih baik daripada alat yang punya kemampuan
itu tapi kita janji tidak memakainya.

### Yang tidak pernah dilakukan

- `DROP DATABASE` dalam bentuk apa pun.
- `TRUNCATE` tanpa persetujuan tertulis.
- Reset skema atau force-reset.
- Migration destruktif tanpa jalur rollback.
- Menyentuh database di luar `snouty*`.
- Menjalankan migration langsung dari mesin pengembang ke produksi.

### Migration destruktif

Menghapus kolom atau tabel dijalankan **dua tahap lintas rilis**, tidak pernah sekali jalan:

1. Rilis N — kode berhenti memakai kolom; kolom tetap ada.
2. Rilis N+1 — setelah terbukti stabil, kolom dihapus lewat migration tersendiri yang disetujui
   terpisah.

Dengan cara ini rollback rilis N tidak pernah kehilangan data.

---

## 5. Konvensi skema

| Aspek | Ketentuan |
|---|---|
| Nama tabel | `snake_case`, jamak (`conversations`, `bom_items`) |
| Primary key | `id` — `CHAR(26)` ULID. Terurut waktu (baik untuk indeks) sekaligus tidak mudah ditebak |
| Foreign key | `<entity>_id`, dengan constraint dalam satu konteks; lintas konteks cukup kolom pemilik tanpa FK |
| Waktu | `DATETIME(3)` UTC. Konversi zona waktu di lapisan tampilan, bukan di database |
| Uang | `DECIMAL(18,2)` — tidak pernah float |
| Enum | `VARCHAR` + `CHECK`, bukan tipe `ENUM` MySQL, supaya penambahan nilai tidak memerlukan `ALTER` tabel besar |
| Boolean | `TINYINT(1)` |
| JSON | `JSON` hanya untuk struktur yang memang tidak perlu di-query (mis. topologi skema) |
| Soft delete | `deleted_at NULL` — hanya pada tabel milik pengguna, demi hak penghapusan data |
| Provenance | kolom `*_provenance` + `*_source` di samping nilainya, **bukan** di dalam blob JSON |

Alasan provenance berupa kolom: invarian P-1 ("`REQUIRES_DOMAIN_VALIDATION` tidak pernah menghasilkan
`VERIFIED`") jadi bisa dibuktikan lewat query SQL, bukan hanya lewat tes unit. Audit data nyata
mengalahkan audit kode.

---

## 6. Peta tabel per konteks

Rincian kolom menyusul bersama implementasi tiap fase; yang ditetapkan sekarang adalah batasnya.

| Konteks | Tabel | Fase |
|---|---|---|
| identity | `users`, `user_roles`, `refresh_tokens`, `guest_sessions`, `consents` | 3 |
| conversation | `conversations`, `messages`, `requirement_snapshots`, `conversation_events` | 3–4 |
| catalog | `catalog_versions`, `products`, `product_sizes`, `product_specs`, `product_compatibility`, `product_documents`, `product_images` | 1 |
| pricing | `price_lists`, `price_list_items` | 8, bersyarat |
| engineering | `engineering_rules`, `engineering_rule_versions`, `rule_validations`, `calculation_traces` | 6 |
| recommendation | `recommendations`, `recommendation_systems`, `recommendation_products`, `bom_items`, `assumptions`, `schematics` | 7–9 |
| report | `reports`, `report_jobs`, `report_number_counters` | 10 |
| handoff | `technical_handoffs`, `handoff_events` | 10 |
| ops | `audit_logs`, `llm_calls`, `job_runs`, `feedback` | 3+ |
| email | `emails`, `email_analyses`, `email_drafts`, `leads` | 11 |
| market | `market_events`, `market_aggregates` | 12 |

### Indeks yang direncanakan sejak awal

Dibuat berdasarkan bentuk query yang benar-benar akan dipakai, bukan ditambahkan setelah lambat:

```sql
products            (family, category, status)
products            (sku) UNIQUE
product_sizes       (product_id, size)
conversations       (owner_id, updated_at DESC)      -- daftar riwayat layar 12
conversations       (status, updated_at DESC)        -- filter status layar 12
messages            (conversation_id, created_at)
requirement_snapshots (conversation_id, version DESC)
calculation_traces  (recommendation_id)
llm_calls           (conversation_id, created_at)
audit_logs          (actor_id, created_at DESC)
report_number_counters (year_month) UNIQUE           -- alokasi SNTY-YYYY-MM-NNNN
```

---

## 7. Koneksi

Satu pool per proses, dibuat di satu `DatabaseModule` dan di-inject. Tidak ada modul yang membuka
koneksinya sendiri.

| Parameter | API | Worker |
|---|---|---|
| `DB_POOL_MAX` | 10 | 5 |
| connect timeout | 5 s | 10 s |
| idle timeout | 60 s | 60 s |

Ukuran pool sengaja sederhana. Server ini melayani delapan aplikasi; membuka pool besar "untuk
jaga-jaga" mengambil kapasitas dari tetangga. Naikkan hanya bila ada bukti antrean koneksi.

Saat koneksi gagal: API mengembalikan kode `SERVICE_UNAVAILABLE`, `/health` melaporkan
`{ db: "down" }`, dan error driver mentah tidak pernah sampai ke klien. Health check hanya
menjalankan `SELECT 1` — tidak menghitung baris, tidak membaca tabel.

---

## 8. Backup dan restore

**Kepemilikan belum ditetapkan.** SPEC §17 mewajibkan dokumen ini mencatatnya, jadi ini dicatat
sebagai lubang yang harus ditutup, bukan diisi asumsi.

| Pertanyaan | Jawaban |
|---|---|
| Siapa yang menjalankan backup `192.168.1.136`? | **belum diketahui** |
| Frekuensi dan retensi? | **belum diketahui** |
| Kapan restore terakhir diuji? | **belum diketahui** |
| Di mana backup disimpan? | **belum diketahui** |

Tiga dari empat pertanyaan itu harus terjawab **sebelum** migration pertama dijalankan, karena
prosedur di §4 langkah 6 mensyaratkan backup yang terkonfirmasi. Pertanyaan keempat — kapan restore
terakhir diuji — layak ditanyakan karena backup yang belum pernah dipulihkan belum tentu backup.

Untuk data SNOUTY sendiri, sampai ada jawaban: sebelum migration apa pun ke `snouty`, ambil dump
logis khusus database ini lebih dulu.

```bash
# dump satu database saja; jangan pernah --all-databases di host bersama
mysqldump --single-transaction --routines --triggers \
          --databases snouty > snouty-$(date +%Y%m%d-%H%M).sql
```

`--single-transaction` menjaga agar dump tidak mengunci tabel aplikasi lain.

---

## 9. Kredensial

| Aturan | |
|---|---|
| Sumber | hanya variabel environment |
| `.env` | di `.gitignore`, tidak pernah di-commit |
| `.env.example` | daftar kunci dengan nilai kosong (SPEC §17b) |
| Log | tidak pernah memuat kredensial atau connection string lengkap |
| Dokumen | tidak pernah memuat password — termasuk dokumen ini |
| Rotasi | bila kredensial pernah masuk ke riwayat Git, ia dianggap bocor dan wajib dirotasi |

Baris terakhir bukan formalitas: menghapus commit tidak menghapus kredensial dari klon yang sudah
tersebar.
