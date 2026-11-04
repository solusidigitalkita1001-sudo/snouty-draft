#!/usr/bin/env bash
# Pencatat metrik host selama uji kapasitas: satu baris per 10 detik, dibaca oleh
# snouty-load.mjs lewat --host-metrics untuk menghentikan pengujian sebelum servernya tersiksa.
#
# Dijalankan dari mesin penguji, keluarannya ditulis lokal:
#   ssh -i ~/.ssh/snouty_deploy snouty@192.168.1.10 'bash -s' < scripts/load-test/host-sampler.sh > host.csv
#
# Kolom: ts,load1,mem_free_mb,disk_free_gb,cpu_api,cpu_ollama
set -u
echo "ts,load1,mem_free_mb,disk_free_gb,cpu_api,cpu_ollama"
while true; do
  load1=$(awk '{print $1}' /proc/loadavg)
  mem_free_mb=$(awk '/MemAvailable/ {printf "%d", $2/1024}' /proc/meminfo)
  disk_free_gb=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
  # Dua kontainer yang menentukan: API dan layanan model. Gagal dibaca → kosong, bukan nol palsu.
  stats=$(docker stats --no-stream --format '{{.Name}} {{.CPUPerc}}' 2>/dev/null || true)
  cpu_api=$(echo "$stats" | awk '/snouty-api/ {gsub("%","",$2); print $2; exit}')
  cpu_ollama=$(echo "$stats" | awk '/ollama/ {gsub("%","",$2); print $2; exit}')
  echo "$(date +%s),${load1},${mem_free_mb},${disk_free_gb},${cpu_api:-},${cpu_ollama:-}"
  sleep 10
done
