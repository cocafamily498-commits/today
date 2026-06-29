$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectDir ".local-server.pid"

function Get-LocalServerProcess {
  $portLine = netstat -ano | Select-String "LISTENING\s+(\d+)$" | Where-Object {
    $_.Line -match "[:.]3000\s+"
  } | Select-Object -First 1

  if (-not $portLine -or $portLine.Line -notmatch "LISTENING\s+(\d+)$") {
    return $null
  }

  return Get-Process -Id $Matches[1] -ErrorAction SilentlyContinue
}

$process = $null
if (Test-Path $pidFile) {
  $savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  $process = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
}

if (-not $process) {
  $process = Get-LocalServerProcess
}

if ($process -and $process.ProcessName -eq "node") {
  Stop-Process -Id $process.Id -Force
  Write-Host "Da dung server (PID $($process.Id))."
} elseif ($process) {
  Write-Host "PID $($process.Id) khong phai server Node. Chi xoa file PID cu."
} else {
  Write-Host "Khong tim thay server nen dang chay."
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
