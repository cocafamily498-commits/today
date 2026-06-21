$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectDir ".local-server.pid"
$stdoutFile = Join-Path $projectDir "local-server.log"
$stderrFile = Join-Path $projectDir "local-server-error.log"
$serverUrl = "http://127.0.0.1:3000"

function Test-LocalServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $serverUrl -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (Test-Path $pidFile) {
  $savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  $savedProcess = if ($savedPid) { Get-Process -Id $savedPid -ErrorAction SilentlyContinue } else { $null }
  if ($savedProcess -and $savedProcess.ProcessName -eq "node" -and (Test-LocalServer)) {
    Write-Host "Server dang chay (PID $savedPid): http://localhost:3000"
    exit 0
  }
  if ($savedProcess -and $savedProcess.ProcessName -eq "node") {
    Stop-Process -Id $savedProcess.Id -Force -ErrorAction SilentlyContinue
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

$ready = $false
for ($attempt = 0; $attempt -lt 10; $attempt++) {
  Start-Sleep -Milliseconds 500
  if ($process.HasExited) { break }
  if (Test-LocalServer) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  Write-Host "Khong the khoi dong server. Chi tiet:"
  Get-Content $stderrFile -ErrorAction SilentlyContinue
  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
  exit 1
}

Set-Content -LiteralPath $pidFile -Value $process.Id
Write-Host "Server da chay nen (PID $($process.Id)): http://localhost:3000"
Write-Host "Ban co the dong terminal. Chay stop-background.cmd de dung server."
