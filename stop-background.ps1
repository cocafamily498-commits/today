$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectDir ".local-server.pid"

if (-not (Test-Path $pidFile)) {
  Write-Host "Khong tim thay server nen dang chay."
  exit 0
}

$savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue
$process = Get-Process -Id $savedPid -ErrorAction SilentlyContinue

if ($process) {
  Stop-Process -Id $savedPid -Force
  Write-Host "Da dung server (PID $savedPid)."
} else {
  Write-Host "Server da dung tu truoc."
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
