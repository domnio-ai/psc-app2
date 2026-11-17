param(
    [Parameter(Mandatory=$true)][string]$Checkpoint,
    [string]$App2Root = "C:\Users\Admin\Documents\Codex\2026-07-28\referenced-chatgpt-conversation-this-is-untrusted\app2",
    [switch]$RestoreDatabase
)

$ErrorActionPreference = "Stop"

$SourceZip = Join-Path $Checkpoint "app2-protected-source.zip"
$DbBackup = Join-Path $Checkpoint "psc_app2.backup"
$Backend = Join-Path $App2Root "backend"
$GuardScripts = Join-Path $App2Root "scripts\guard"

if (-not (Test-Path $SourceZip)) { throw "Checkpoint source archive not found: $SourceZip" }

$Safety = Join-Path $App2Root ("restore-safety-before-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $Safety -Force | Out-Null

Write-Host "Creating pre-restore safety copy..." -ForegroundColor Cyan

foreach ($Relative in @("src","backend\src","backend\migrations")) {
    $Current = Join-Path $App2Root $Relative
    if (Test-Path $Current) {
        $Dest = Join-Path $Safety $Relative
        New-Item -ItemType Directory -Path (Split-Path $Dest -Parent) -Force | Out-Null
        Copy-Item $Current $Dest -Recurse -Force
    }
}

$Temp = Join-Path $env:TEMP ("app2-restore-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $Temp -Force | Out-Null

try {
    Expand-Archive -Path $SourceZip -DestinationPath $Temp -Force

    foreach ($Relative in @("src","backend\src","backend\migrations")) {
        $From = Join-Path $Temp $Relative
        $To = Join-Path $App2Root $Relative
        if (Test-Path $From) {
            if (Test-Path $To) { Remove-Item $To -Recurse -Force }
            New-Item -ItemType Directory -Path (Split-Path $To -Parent) -Force | Out-Null
            Copy-Item $From $To -Recurse -Force
        }
    }

    foreach ($File in @("package.json","package-lock.json","vite.config.ts","vite.config.js","tsconfig.json")) {
        $From = Join-Path $Temp $File
        $To = Join-Path $App2Root $File
        if (Test-Path $From) { Copy-Item $From $To -Force }
    }

    if ($RestoreDatabase) {
        if (-not (Test-Path $DbBackup)) { throw "Checkpoint database backup not found: $DbBackup" }
        . (Join-Path $GuardScripts "App2Guard.Common.ps1")
        $DatabaseUrl = Get-App2DatabaseUrl -Backend $Backend
        $PgRestore = Get-PostgresTool -Name "pg_restore.exe"

        Write-Host "Restoring PostgreSQL from checkpoint..." -ForegroundColor Yellow
        & $PgRestore "--dbname=$DatabaseUrl" "--clean" "--if-exists" "--no-owner" "--no-privileges" $DbBackup
        if ($LASTEXITCODE -ne 0) { throw "Database restore failed." }
    }

    & (Join-Path $GuardScripts "Verify-App2-Regression.ps1") -App2Root $App2Root -Mode Full -SkipDataCountFloor:$RestoreDatabase
    if ($LASTEXITCODE -ne 0) { throw "Restored checkpoint did not pass regression verification." }

    Write-Host "" 
    Write-Host "APP2 CHECKPOINT RESTORED" -ForegroundColor Green
    Write-Host "Checkpoint: $Checkpoint"
    Write-Host "Pre-restore safety copy: $Safety"
}
finally {
    if (Test-Path $Temp) { Remove-Item $Temp -Recurse -Force -ErrorAction SilentlyContinue }
}
