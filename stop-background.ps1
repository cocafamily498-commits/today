$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectDir ".local-server.pid"

if (-not (Test-Path $pidFile)) {
  Write-Host "Khong tim thay server nen dang chay."
  exit 0
}

$savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue
$process = Get-Process -Id $savedPid -ErrorAction SilentlyContinue

if ($process -and $process.ProcessName -eq "node") {
  Stop-Process -Id $savedPid -Force
  Write-Host "Da dung server (PID $savedPid)."
} elseif ($process) {
  Write-Host "PID $savedPid khong phai server Node. Chi xoa file PID cu."
} else {
  Write-Host "Server da dung tu truoc."
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
