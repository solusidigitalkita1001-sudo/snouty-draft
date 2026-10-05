# Menghentikan server yang dinyalakan scripts/dev-up.ps1 (web :3000, API :3001, worker).
# Kontainer dibiarkan berjalan -- `docker compose stop` bila perlu.

foreach ($port in 3000, 3001) {
  Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -gt 0 } |
    ForEach-Object { taskkill /PID $_ /T /F 2>$null | Out-Null; Write-Host "port $port dihentikan (PID $_)" }
}

$workerPid = Join-Path $env:TEMP 'snouty-dev\worker.pid'
if (Test-Path $workerPid) {
  $id = Get-Content $workerPid
  taskkill /PID $id /T /F 2>$null | Out-Null
  Remove-Item $workerPid
  Write-Host "worker dihentikan (PID $id)"
}
