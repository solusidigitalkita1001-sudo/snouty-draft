# SNOUTY — Prosedur Insiden Keamanan

Runbook untuk dugaan kebocoran data, akses tidak sah, atau server disusupi. Melengkapi
`docs/PRIVACY.md` §10 (kewajiban UU PDP) dan `docs/DEPLOYMENT.md`. Semua perintah dijalankan di
`snouty@192.168.1.10`, dari `~/snouty`, dengan

```bash
C="docker compose --env-file .env.production -f deploy/docker-compose.prod.yml"
set -a; . ./.env.production; set +a
```

## 0. Kontak (diisi pemilik — belum ditetapkan)

| Peran                                  | Nama | Kontak |
| -------------------------------------- | ---- | ------ |
| Penanggung jawab insiden (pemilik)     | —    | —      |
| Pejabat pelindungan data (PDP)         | —    | —      |
| Admin server 192.168.1.10 (punya sudo) | —    | —      |
| Pemilik aplikasi bagspace (nginx sama) | —    | —      |

Selama tabel ini kosong, langkah 5 tidak bisa dijalankan tepat waktu — **mengisinya adalah bagian dari
kesiapan produksi**.

## 1. Kenali (menit 0–30)

Tanda yang perlu ditindaklanjuti: lonjakan `429`/`401` di log API, login dari pola asing, isi tabel
berubah tanpa rilis, berkas tak dikenal di server, laporan pengguna.

```bash
$C logs --since 2h api worker | grep -iE "error|denied|401|403|429" | tail -50
$C logs --since 2h nginx | tail -100            # akses masuk, termasuk IP
$C exec -T mysql mysql -uroot -p"$DB_ROOT_PASSWORD" -N "$DB_DATABASE" \
  -e "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50" </dev/null
```

Catat waktu insiden **diketahui** — tenggat UU PDP 3×24 jam dihitung dari sini.

## 2. Bendung (jam pertama)

Pilih sesuai tingkat — dari yang paling ringan:

1. **Keluarkan semua sesi** (akses token hidup ±menit, refresh token dicabut):
   ```bash
   $C exec -T mysql mysql -uroot -p"$DB_ROOT_PASSWORD" "$DB_DATABASE" \
     -e "UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE revoked_at IS NULL" </dev/null
   ```
2. **Ganti rahasia** bila `.env.production` mungkin terbaca: buat `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET` baru (`openssl rand -base64 48`), juga kata sandi DB, lalu
   `deploy/deploy.sh up`. Semua token lama langsung tidak sah.
3. **Matikan aplikasi, data tetap utuh**: `$C stop web api worker` — nginx tetap jalan (bagspace tidak
   ikut mati); halaman SNOUTY menjadi 502.
4. **Putus dari jaringan** bila server sendiri disusupi: minta admin server (punya sudo) — user `snouty`
   tidak bisa mengubah firewall.

## 3. Amankan bukti (sebelum memperbaiki apa pun)

```bash
mkdir -p ~/incident-$(date +%Y%m%d) && cd ~/incident-$(date +%Y%m%d)
for s in nginx api web worker mysql; do $C logs --timestamps $s > $s.log 2>&1; done
deploy/deploy.sh db-backup                       # salinan data saat ini, untuk perbandingan
sha256sum *.log > SHA256SUMS
```

Jangan menghapus atau menimpa berkas di server sampai bukti tersalin ke luar server.

## 4. Tentukan cakupan

Tabel yang memuat data pribadi: `users`, `consents`, `conversations`, `messages`,
`requirement_snapshots`, `technical_handoffs`, `uploads`, `guest_sessions`, `emails`, `email_analyses`,
`reports`, `audit_logs`. Data katalog produk publik.

Pertanyaan yang harus terjawab: data siapa (akun terdaftar / tamu), jenis data (nama, email, telepon,
lokasi, isi konsultasi, berkas denah), rentang waktu, dan apakah data keluar dari server.

Model AI berjalan **lokal di server** (Ollama; `OPENROUTER_BASE_URL=http://ollama:11434/v1`), jadi isi
percakapan tidak mengalir ke penyedia luar — kecuali konfigurasi itu pernah diubah (periksa
`OPENROUTER_BASE_URL` di `.env.production` dan kolom `model` di `llm_calls` pada rentang insiden).

**Keterbatasan saat ini:** `audit_logs` baru berisi satu baris (2026-10-14) — tindakan pengguna belum
tercatat cukup untuk menentukan siapa yang terdampak dari log saja. Cakupan ditentukan dari `created_at`
tiap tabel di atas dan log nginx (IP, waktu).

## 5. Beri tahu (≤ 3×24 jam sejak diketahui)

Oleh penanggung jawab dan pejabat PDP (tabel §0), sesuai UU PDP: subjek data yang terdampak dan
otoritas, berisi apa yang terjadi, data apa, kapan, langkah yang diambil, dan kontak. Pengguna terdaftar
dihubungi lewat email di `users`; tamu tidak punya kontak — dicatat apa adanya.

## 6. Pulihkan

- Data rusak/terhapus: pulihkan dari `~/backups` (cadangan harian, 14 hari). Uji dulu dengan
  `deploy/restore-check.sh <berkas>` — memulihkan ke kontainer sementara dan membandingkan jumlah baris.
- Kode/server: rilis dari commit yang diketahui bersih (`git log`), `deploy/deploy.sh release`.
- Periksa ulang: `pnpm audit --prod`, header (`curl -sI https://ai.pralon.co.id`), port terbuka hanya
  22/80/443, hak user DB (`deploy/deploy.sh db-grants`).

## 7. Tinjau (≤ 2 minggu)

Tulis kronologi, akar masalah, dan perbaikan permanen di `docs/SECURITY.md`; tambahkan tes atau
pemeriksaan yang akan menangkapnya lebih awal.
