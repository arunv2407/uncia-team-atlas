$ErrorActionPreference = 'Stop'
$projectPath = $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js 24 or newer is required. Ask IT to install Node.js.' }
$serverPath = Join-Path $projectPath 'local/server.mjs'
$dataPath = Join-Path $projectPath '.local-data'
if (-not (Test-Path -LiteralPath (Join-Path $dataPath 'atlas.sqlite'))) { throw 'Initial account setup has not been completed.' }
try {
    $status = Invoke-RestMethod -Uri 'http://127.0.0.1:5174/health' -TimeoutSec 2
    if ($status.service -eq 'uncia-local-atlas') { Write-Output 'Already running: http://127.0.0.1:5174/'; exit 0 }
} catch { }
$stdoutPath = Join-Path $dataPath 'server.log'
$stderrPath = Join-Path $dataPath 'server-errors.log'
$appProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList @('"' + $serverPath + '"') -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
Set-Content -LiteralPath (Join-Path $dataPath 'server.pid') -Value $appProcess.Id
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 300
    try { $status = Invoke-RestMethod -Uri 'http://127.0.0.1:5174/health' -TimeoutSec 1; if ($status.service -eq 'uncia-local-atlas') { Write-Output 'Ready: http://127.0.0.1:5174/'; exit 0 } } catch { }
}
throw 'The app could not start. Check .local-data/server-errors.log.'
