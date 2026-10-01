$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectPath
if (Get-NetTCPConnection -LocalPort 3014 -State Listen -ErrorAction SilentlyContinue) { exit 0 }
$nodePath = (Get-Command node.exe).Source
$entryPath = Join-Path $projectPath 'node_modules\tsx\dist\cli.mjs'
New-Item -ItemType Directory -Force -Path (Join-Path $projectPath 'logs') | Out-Null
Start-Process -FilePath $nodePath -ArgumentList @(('"' + $entryPath + '"'), 'server.ts') -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectPath 'logs\server.log') -RedirectStandardError (Join-Path $projectPath 'logs\server-error.log')
