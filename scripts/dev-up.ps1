# Menjalankan SNOUTY lengkap untuk diuji dengan tangan -- versi Windows dari dev-up.sh.
#
# Jalankan lewat `pnpm dev:up:win`. Script dijalankan di proses PowerShell terpisah
# (-File), supaya variabel environment di bawah tidak menempel di terminal pemanggil,
# dan -ExecutionPolicy Bypass supaya tidak ditolak kebijakan eksekusi bawaan Windows.
#
# Urutan dan alasannya sama dengan dev-up.sh -- baca komentar di sana. Yang berbeda hanya
# mekanismenya: tidak ada pkill/lsof/curl-bash di Windows, jadi proses dicari lewat port
# yang dipegangnya, dan log server ditulis ke berkas, bukan ke terminal.
#
# Berkas ini sengaja ASCII saja: PowerShell 5.1 membaca .ps1 tanpa BOM sebagai ANSI.

# Bukan 'Stop': di PowerShell 5.1 itu mengubah setiap baris stderr program native --
# docker menulis progres ke stderr -- menjadi galat fatal. Kegagalan diperiksa lewat
# exit code di Run().
$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')
$root = (Get-Location).Path
$logDir = Join-Path $env:TEMP 'snouty-dev'
New-Item -ItemType Directory -Force $logDir | Out-Null

function Step($msg) { Write-Host "> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "x $msg" -ForegroundColor Red; exit 1 }

# Menjalankan perintah native dan berhenti bila gagal. $ErrorActionPreference tidak
# berlaku untuk exit code program native di PowerShell 5.1.
function Run($label, [scriptblock]$block) {
  & $block
  if ($LASTEXITCODE -ne 0) { Fail "$label gagal (exit $LASTEXITCODE)" }
}

function PortOwners($port) {
  Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -gt 0 }
}

function WaitHttp($url, $seconds) {
  for ($i = 0; $i -lt $seconds; $i++) {
    curl.exe -sf -o NUL $url 2>$null
    if ($LASTEXITCODE -eq 0) { return $true }
    Start-Sleep 1
  }
  return $false
}

# --- Hentikan server lama LEBIH DULU, sebelum build (lihat dev-up.sh) ---
Step 'menghentikan server lama'
foreach ($port in 3000, 3001) {
  foreach ($procId in PortOwners $port) {
    # /T ikut menghentikan anak prosesnya; `next start` bercabang menjadi next-server.
    taskkill /PID $procId /T /F 2>$null | Out-Null
  }
}
# Worker tidak memegang port, jadi ia dilacak lewat berkas PID.
$workerPid = Join-Path $logDir 'worker.pid'
if (Test-Path $workerPid) {
  taskkill /PID (Get-Content $workerPid) /T /F 2>$null | Out-Null
  Remove-Item $workerPid
}
foreach ($port in 3000, 3001) {
  $free = $false
  for ($i = 0; $i -lt 20; $i++) {
    if (-not (PortOwners $port)) { $free = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $free) {
    Fail "port $port masih terpakai (PID $((PortOwners $port) -join ', ')). Hentikan prosesnya lalu jalankan ulang."
  }
}

# --- Kontainer ---
Step 'kontainer'
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'Docker tidak berjalan. Buka Docker Desktop lalu jalankan ulang.' }
Run 'docker compose up' { docker compose up -d mysql redis rabbitmq 2>$null | Out-Null }
do {
  Start-Sleep 1
  docker compose exec -T mysql mysqladmin ping -h localhost --silent 2>$null | Out-Null
} until ($LASTEXITCODE -eq 0)

# .env di akar repo: tempat kunci model dan ID model (tidak pernah di-commit). Dibaca
# LEBIH DULU, lalu nilai infrastruktur di bawah menimpanya -- pengembangan selalu memakai
# kontainer lokal, apa pun isi .env. Yang bertahan dari .env hanya yang tidak diset di sini
# (OPENROUTER_API_KEY, LLM_MODEL_*, dan sebagainya).
$dotenv = Join-Path $root '.env'
if (Test-Path $dotenv) {
  foreach ($line in Get-Content $dotenv) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$' -and $line -notmatch '^\s*#') {
      $name = $Matches[1]; $value = $Matches[2].Trim('"', "'")
      if ($value -ne '') { Set-Item -Path "Env:$name" -Value $value }
    }
  }
}

# NODE_ENV sengaja diset per langkah, bukan sekali -- alasannya di dev-up.sh.
$env:SNOUTY_FAKE_AI = '1'
$env:PORT = '3001'
$env:DB_HOST = '127.0.0.1'; $env:DB_PORT = '3316'; $env:DB_DATABASE = 'snouty'
$env:DB_USERNAME = 'root'; $env:DB_PASSWORD = 'snouty'; $env:DB_POOL_MAX = '5'
$env:REDIS_URL = 'redis://127.0.0.1:6380'
$env:RABBITMQ_URL = 'amqp://guest:guest@127.0.0.1:5673'
$env:JWT_ACCESS_SECRET = 'contoh-rahasia-pengembangan-32-karakter'
$env:JWT_REFRESH_SECRET = 'contoh-rahasia-refresh-32-karakter-lagi'
$env:POLICY_VERSION = 'v0-draft'
# Dibaca API (rute unduh) DAN worker (penulis PDF) -- harus folder yang sama.
$env:STORAGE_PATH = Join-Path $logDir 'storage'
$env:NEXT_TELEMETRY_DISABLED = '1'

Set-Location (Join-Path $root 'apps/api')

Step 'migration'
$env:NODE_ENV = 'development'
Run 'migration' { node scripts/db-apply.mjs | Out-Null }

Step 'katalog contoh (bila belum ada versi aktif)'
$env:SEED_SAMPLE_CATALOG = '1'
$env:SAMPLE_LABEL = "dev-$(Get-Date -Format HHmmss)"
node scripts/seed-sample-catalog.mjs *> $null # gagal = katalog sudah ada; sama seperti `|| true`
Remove-Item Env:SEED_SAMPLE_CATALOG, Env:SAMPLE_LABEL

Step 'build'
Set-Location $root
Run 'build:types' { pnpm build:types | Out-Null }
Set-Location (Join-Path $root 'apps/api')
Run 'tsc api' { pnpm exec tsc -p tsconfig.build.json }

# `next build` WAJIB NODE_ENV=production -- lihat dev-up.sh.
Set-Location (Join-Path $root 'apps/web')
$env:NODE_ENV = 'production'
Run 'next build' { pnpm exec next build | Out-Null }

# --- Server ---
# Adapter sungguhan menang bila kunci + tiga ID model ada (apps/api/src/modules/ai/ai.module.ts).
$llmReady = $env:OPENROUTER_API_KEY -and $env:LLM_MODEL_FAST -and $env:LLM_MODEL_BALANCED -and $env:LLM_MODEL_STRONG
if ($llmReady) { Step "LLM: OpenRouter aktif ($env:LLM_MODEL_FAST / $env:LLM_MODEL_BALANCED / $env:LLM_MODEL_STRONG)" }
else { Step 'LLM: adapter dev (regex) -- isi OPENROUTER_API_KEY + LLM_MODEL_* di .env untuk model sungguhan' }

Step 'API di :3001'
$env:NODE_ENV = 'development'
$apiLog = Join-Path $logDir 'api.log'
Start-Process node -ArgumentList 'scripts/dev-serve.mjs' -WorkingDirectory (Join-Path $root 'apps/api') `
  -WindowStyle Hidden -RedirectStandardOutput $apiLog -RedirectStandardError "$apiLog.err" | Out-Null
if (-not (WaitHttp 'http://127.0.0.1:3001/health' 40)) {
  Write-Host (Get-Content "$apiLog.err" -Tail 20 -ErrorAction SilentlyContinue | Out-String)
  Fail "API tidak merespons di :3001 setelah 40 detik. Log lengkap: $apiLog.err"
}

Step 'web di :3000'
$env:NODE_ENV = 'production'
$webLog = Join-Path $logDir 'web.log'
Start-Process node -ArgumentList 'node_modules/next/dist/bin/next', 'start', '--port', '3000' `
  -WorkingDirectory (Join-Path $root 'apps/web') `
  -WindowStyle Hidden -RedirectStandardOutput $webLog -RedirectStandardError "$webLog.err" | Out-Null
if (-not (WaitHttp 'http://127.0.0.1:3000/' 60)) {
  Fail "web tidak merespons di :3000 setelah 60 detik. Log lengkap: $webLog.err"
}

# Worker: PDF laporan. Butuh Chromium Playwright -- sekali per mesin:
#   pnpm --filter @snouty/worker exec playwright-core install chromium
Step 'worker (PDF laporan)'
Set-Location $root
Run 'build worker' { pnpm --filter @snouty/worker build | Out-Null }
$env:NODE_ENV = 'development'
$env:WORKER_INTERNAL_TOKEN = (node (Join-Path $root 'apps/api/scripts/dev-worker-token.mjs'))
if ($LASTEXITCODE -ne 0) { Fail 'token worker gagal dibuat' }
$env:API_URL = 'http://127.0.0.1:3001'
$workerLog = Join-Path $logDir 'worker.log'
$worker = Start-Process node -ArgumentList 'dist/main.js' -WorkingDirectory (Join-Path $root 'apps/worker') `
  -WindowStyle Hidden -RedirectStandardOutput $workerLog -RedirectStandardError "$workerLog.err" -PassThru
Set-Content $workerPid $worker.Id
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
  if (Select-String -Path $workerLog -Pattern 'worker siap' -Quiet -ErrorAction SilentlyContinue) { $ready = $true; break }
  if ($worker.HasExited) { break }
  Start-Sleep 1
}
if (-not $ready) {
  Write-Host (Get-Content $workerLog, "$workerLog.err" -Tail 20 -ErrorAction SilentlyContinue | Out-String)
  Fail "worker tidak siap setelah 20 detik. Log: $workerLog"
}

Write-Host @"

  SNOUTY siap diuji -- buka http://localhost:3000

  /              welcome + onboarding 5 langkah (onboarding sekali per sesi tamu)
  /consultation  chat -> klarifikasi -> analisis -> solusi -> BOM -> skema
  /schematic     skema penuh (dibuka dari solusi)
  /login         masuk        <- menunggu desain
  /register      daftar akun  <- menunggu desain
  /internal/*    back-office  <- menunggu desain
  /tokens        galeri token desain

  Coba tulis di /consultation:
    "Rumah 2 lantai, 3 kamar mandi, 4 wastafel, 1 dapur, toren di atap, air bersih"
    lalu tekan "Analisis kebutuhan".

  Yang menguji jalur kebijakan:
    "lebih bagus Pralon atau Rucika?"   -> kartu kriteria netral, bukan rekomendasi
    "bangun pabrik 2 lantai"            -> kartu validasi teknis
    "rumah 2 lantai"                    -> kartu klarifikasi bernomor

  RabbitMQ UI:   http://localhost:15673  (guest / guest)
  PDF laporan:   $logDir\storage\reports

  Log server: $logDir
  Hentikan:   pnpm dev:down:win
"@
