#!/usr/bin/env bash
# SNOUTY — pindahkan model chat ke OpenRouter (docs/DEPLOYMENT.md §4b), sekali jalan.
#
#   deploy/use-openrouter.sh [model]     baku: google/gemma-4-31b-it:free
#   deploy/use-openrouter.sh --local     kembali ke qwen2.5 7B di Ollama lokal
#
# Key diminta tanpa ditampilkan (read -s) dan tidak pernah dicetak, masuk riwayat shell, atau
# argumen proses. `.env.production` dicadangkan dulu ke `.env.production.bak-<waktu>`.
# Embedding (bge-m3) tetap di Ollama lokal. Setelah ditulis, release dijalankan.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.production"
[ -f "$ENV_FILE" ] || { echo "✖ $ENV_FILE tidak ada"; exit 1; }

# Ganti baris KEY=... bila ada, tambahkan bila belum. Nilai lewat env, bukan argumen sed,
# supaya key tidak terlihat di daftar proses.
set_env() {
  KEY="$1" VALUE="$2" ENV_FILE="$ENV_FILE" node -e '
    const fs = require("fs");
    const { KEY, VALUE, ENV_FILE } = process.env;
    const lines = fs.readFileSync(ENV_FILE, "utf8").split("\n");
    const i = lines.findIndex((l) => l.startsWith(KEY + "="));
    if (i >= 0) lines[i] = KEY + "=" + VALUE;
    else lines.splice(lines[lines.length - 1] === "" ? lines.length - 1 : lines.length, 0, KEY + "=" + VALUE);
    fs.writeFileSync(ENV_FILE, lines.join("\n"));
  ' 2>/dev/null || {
    # Host tanpa node: jatuh ke awk (nilai tetap lewat env).
    KEY="$1" VALUE="$2" awk -v OFS= 'BEGIN{k=ENVIRON["KEY"];v=ENVIRON["VALUE"];done=0}
      index($0,k"=")==1{print k"="v;done=1;next}{print}END{if(!done)print k"="v}' "$ENV_FILE" >"$ENV_FILE.tmp"
    mv "$ENV_FILE.tmp" "$ENV_FILE"
  }
}

# Hapus baris KEY=... — nilai kosong ditolak skema env API (min 1 karakter).
unset_env() {
  grep -v "^$1=" "$ENV_FILE" >"$ENV_FILE.tmp" || true
  mv "$ENV_FILE.tmp" "$ENV_FILE"
}

cp "$ENV_FILE" "$ENV_FILE.bak-$(date +%Y%m%d-%H%M%S)"
chmod 600 "$ENV_FILE"

if [ "${1:-}" = "--local" ]; then
  set_env OPENROUTER_BASE_URL "http://ollama:11434/v1"
  unset_env OPENROUTER_API_KEY
  unset_env EMBEDDING_BASE_URL
  for m in LLM_MODEL_FAST LLM_MODEL_BALANCED LLM_MODEL_STRONG; do set_env "$m" "qwen2.5:7b-instruct"; done
  set_env LLM_CALL_TIMEOUT_MS 180000
  set_env LLM_REPLY_TIMEOUT_MS 30000
  echo "✓ kembali ke model lokal"
else
  MODEL="${1:-google/gemma-4-31b-it:free}"
  read -r -s -p "Tempel OpenRouter API key (tidak ditampilkan), lalu Enter: " KEY_INPUT
  echo
  [ -n "$KEY_INPUT" ] || { echo "✖ key kosong — tidak ada yang diubah"; exit 1; }
  # Cek key sebelum menulis apa pun ke konfigurasi produksi.
  # Header lewat stdin (-K -), bukan argumen: key tidak terlihat di daftar proses.
  status=$(printf 'header = "Authorization: Bearer %s"\n' "$KEY_INPUT" |
    curl -s -o /dev/null -w '%{http_code}' -K - https://openrouter.ai/api/v1/key || true)
  [ "$status" = "200" ] || { echo "✖ OpenRouter menolak key (HTTP $status) — tidak ada yang diubah"; exit 1; }
  set_env OPENROUTER_BASE_URL "https://openrouter.ai/api/v1"
  set_env OPENROUTER_API_KEY "$KEY_INPUT"
  unset KEY_INPUT
  for m in LLM_MODEL_FAST LLM_MODEL_BALANCED LLM_MODEL_STRONG; do set_env "$m" "$MODEL"; done
  set_env EMBEDDING_BASE_URL "http://ollama:11434/v1"
  set_env LLM_CALL_TIMEOUT_MS 30000
  set_env LLM_REPLY_TIMEOUT_MS 8000
  echo "✓ key valid; model chat: $MODEL"
fi

"$ROOT/deploy/deploy.sh" release
