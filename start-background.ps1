$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectDir ".local-server.pid"
$stdoutFile = Join-Path $projectDir "local-server.log"
$stderrFile = Join-Path $projectDir "local-server-error.log"

if (Test-Path $pidFile) {
  $savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  $savedProcess = if ($savedPid) { Get-Process -Id $savedPid -ErrorAction SilentlyContinue } else { $null }
  if ($savedProcess -and $savedProcess.ProcessName -eq "node") {
    Write-Host "Server dang chay (PID $savedPid): http://localhost:3000"
    exit 0
  }
  Remove-Item $pidFile -Force
}

$process = Start-Process `
  -FilePath "node" `
  -ArgumentList "server.js" `
  -WorkingDirectory $projectDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutFile `
  -RedirectStandardError $stderrFile `
  -PassThru

Start-Sleep -Seconds 2
if ($process.HasExited) {
  Write-Host "Khong the khoi dong server. Chi tiet:"
  Get-Content $stderrFile -ErrorAction SilentlyContinue
  exit 1
}

Set-Content -LiteralPath $pidFile -Value $process.Id
Write-Host "Server da chay nen (PID $($process.Id)): http://localhost:3000"
Write-Host "Ban co the dong terminal. Chay stop-background.cmd de dung server."
