$ErrorActionPreference = 'Stop'
$pidPath = Join-Path $PSScriptRoot '.local-data/server.pid'
if (-not (Test-Path -LiteralPath $pidPath)) { Write-Output 'No managed local server is running.'; exit 0 }
$serverProcessId = [int](Get-Content -LiteralPath $pidPath)
$appProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $serverProcessId"
$expectedScript = Join-Path $PSScriptRoot 'local/server.mjs'
if ($appProcess -and $appProcess.CommandLine.Contains($expectedScript)) { Stop-Process -Id $serverProcessId; Write-Output 'Org chart stopped.' } else { Write-Output 'The saved process is no longer the org chart server.' }
