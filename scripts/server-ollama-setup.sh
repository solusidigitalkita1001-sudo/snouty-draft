#!/usr/bin/env bash
# Memasang Ollama + model untuk SNOUTY di server (Ubuntu 22.04, tanpa GPU, 4 vCPU, 16 GB RAM).
# Jalankan di server sebagai pengguna ber-sudo:   bash server-ollama-setup.sh
#
# Hasilnya: Ollama sebagai layanan systemd, mendengarkan di 0.0.0.0:11434 (LAN), dengan
# model qwen2.5:7b-instruct siap dipakai lewat endpoint OpenAI-compatible
# http://<server>:11434/v1 — yang dipakai apps/api lewat OPENROUTER_BASE_URL.
#
# Port 11434 TIDAK boleh terbuka ke internet: Ollama tidak punya autentikasi. Skrip ini
# membatasi ufw ke jaringan lokal bila ufw aktif; untuk akses dari luar kantor pakai
# SSH tunnel (lihat docs/INFRASTRUCTURE.md).
set -euo pipefail

MODEL="${MODEL:-qwen2.5:7b-instruct}"
LAN_CIDR="${LAN_CIDR:-192.168.1.0/24}"

echo "▸ ollama"
if ! command -v ollama >/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sudo sh
fi
ollama --version

echo "▸ mendengarkan di LAN (bukan hanya localhost)"
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf >/dev/null <<'EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
# Satu model tetap di memori 1 jam supaya panggilan pertama tiap pesan tidak memuat ulang.
Environment="OLLAMA_KEEP_ALIVE=1h"
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now ollama
sudo systemctl restart ollama

echo "▸ firewall"
if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
  sudo ufw allow from "$LAN_CIDR" to any port 11434 proto tcp comment 'ollama LAN only'
  sudo ufw status | grep 11434 || true
else
  echo "  ufw tidak aktif — pastikan 11434 tidak terbuka ke internet lewat router/NAT."
fi

echo "▸ model $MODEL (±4.7 GB, sekali saja)"
ollama pull "$MODEL"

echo "▸ uji JSON mode"
curl -s http://127.0.0.1:11434/v1/chat/completions \
  -H 'content-type: application/json' \
  -d "{\"model\":\"$MODEL\",\"temperature\":0,\"response_format\":{\"type\":\"json_object\"},\"messages\":[{\"role\":\"user\",\"content\":\"Jawab JSON {\\\"ok\\\":true}\"}]}" \
  | head -c 300; echo

cat <<INFO

Selesai. Di laptop pengembang, isi .env:
  OPENROUTER_BASE_URL=http://$(hostname -I | awk '{print $1}'):11434/v1
  OPENROUTER_API_KEY=ollama
  LLM_MODEL_FAST=$MODEL
  LLM_MODEL_BALANCED=$MODEL
  LLM_MODEL_STRONG=$MODEL
lalu: pnpm dev:up:win
INFO
