param(
    [string]$App2Root = "C:\Users\Admin\Documents\Codex\2026-07-28\referenced-chatgpt-conversation-this-is-untrusted\app2",
    [string]$Label = "known-good",
    [switch]$Initial,
    [switch]$AcceptDataDecrease
)

$ErrorActionPreference = "Stop"

$Backend = Join-Path $App2Root "backend"
$GuardRoot = Join-Path $App2Root ".app2-guard"
$CheckpointRoot = Join-Path $GuardRoot "checkpoints"
$BaselinePath = Join-Path $GuardRoot "baseline.json"
$ManifestPath = Join-Path $App2Root "APP2_PROTECTED_MODULES.json"

. (Join-Path $PSScriptRoot "App2Guard.Common.ps1")

New-Item -ItemType Directory -Path $GuardRoot -Force | Out-Null
New-Item -ItemType Directory -Path $CheckpointRoot -Force | Out-Null

if (-not $Initial -and (Test-Path $BaselinePath)) {
    & (Join-Path $PSScriptRoot "Verify-App2-Regression.ps1") `
        -App2Root $App2Root `
        -Mode Full `
        -SkipDataCountFloor:$AcceptDataDecrease

    if ($LASTEXITCODE -ne 0) {
        throw "Regression verification failed. Checkpoint was not created."
    }
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$SafeLabel = ($Label -replace '[^A-Za-z0-9._-]','-').Trim('-')
if (-not $SafeLabel) { $SafeLabel = "checkpoint" }

$Checkpoint = Join-Path $CheckpointRoot "$Stamp-$SafeLabel"
New-Item -ItemType Directory -Path $Checkpoint -Force | Out-Null

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " CREATING APP2 CHECKPOINT: $SafeLabel" -ForegroundColor Cyan
Write-Host "=================================================="

$DatabaseUrl = Get-App2DatabaseUrl -Backend $Backend
$Psql = Get-PostgresTool -Name "psql.exe"
$PgDump = Get-PostgresTool -Name "pg_dump.exe"

Write-Host ""
Write-Host "[1/5] Backing up PostgreSQL..." -ForegroundColor Cyan

$DbBackup = Join-Path $Checkpoint "psc_app2.backup"
& $PgDump "--dbname=$DatabaseUrl" "--format=custom" "--no-owner" "--no-privileges" "--file=$DbBackup"
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL backup failed. No checkpoint was approved."
}

Write-Host "  PASS database backup" -ForegroundColor Green

Write-Host ""
Write-Host "[2/5] Capturing current core counts/schema state..." -ForegroundColor Cyan

$Counts = Get-App2CoreCounts -Psql $Psql -DatabaseUrl $DatabaseUrl

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$WorkflowTables = [ordered]@{}
foreach ($Table in @($Manifest.protected_database.workflow_tables_if_installed)) {
    $Sql = "SELECT to_regclass('public.$Table') IS NOT NULL;"
    $Exists = (& $Psql "--dbname=$DatabaseUrl" "-At" "-v" "ON_ERROR_STOP=1" "-c" $Sql | Select-Object -Last 1).Trim()
    $WorkflowTables[$Table] = ($Exists -eq "t")
}

Write-Host "  PASS database state captured" -ForegroundColor Green

Write-Host ""
Write-Host "[3/5] Capturing protected source..." -ForegroundColor Cyan

$CriticalFiles = Get-App2ManagedFileHashes -App2Root $App2Root

$Stage = Join-Path $Checkpoint "_source"
New-Item -ItemType Directory -Path $Stage -Force | Out-Null

foreach ($Relative in $CriticalFiles.Keys) {
    $Source = Join-Path $App2Root ($Relative -replace '/', '\')
    if (-not (Test-Path $Source)) { continue }
    $Destination = Join-Path $Stage ($Relative -replace '/', '\')
    $DestinationDir = Split-Path $Destination -Parent
    New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null
    Copy-Item $Source $Destination -Force
}

$SourceZip = Join-Path $Checkpoint "app2-protected-source.zip"
Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $SourceZip -CompressionLevel Optimal -Force
Remove-Item $Stage -Recurse -Force

Write-Host "  PASS protected source archive" -ForegroundColor Green

Write-Host ""
Write-Host "[4/5] Capturing Git evidence..." -ForegroundColor Cyan

$Git = Get-Command git.exe -ErrorAction SilentlyContinue
$GitCommit = $null
$GitBranch = $null
$GitDirty = $null

if ($Git) {
    Push-Location $App2Root
    try {
        $GitCommit = (& git rev-parse HEAD 2>$null | Select-Object -Last 1)
        $GitBranch = (& git branch --show-current 2>$null | Select-Object -Last 1)
        $Status = (& git status --porcelain=v1 2>$null)
        $GitDirty = [bool]($Status)
        $Status | Set-Content (Join-Path $Checkpoint "git-status.txt") -Encoding UTF8
        (& git diff 2>$null) | Set-Content (Join-Path $Checkpoint "git-diff.txt") -Encoding UTF8
        (& git diff --cached 2>$null) | Set-Content (Join-Path $Checkpoint "git-diff-staged.txt") -Encoding UTF8

        if (-not $GitDirty -and $GitCommit) {
            $Tag = "app2-known-good-$Stamp"
            & git tag $Tag $GitCommit 2>$null
            if ($LASTEXITCODE -eq 0) {
                $Tag | Set-Content (Join-Path $Checkpoint "git-tag.txt") -Encoding UTF8
                Write-Host "  Git tag created: $Tag" -ForegroundColor Green
            }
        }
        elseif ($GitDirty) {
            Write-Host "  NOTICE: Git working tree has changes. Source snapshot was still preserved." -ForegroundColor Yellow
        }
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "  NOTICE: Git not available. Source snapshot was still preserved." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[5/5] Approving new baseline..." -ForegroundColor Cyan

$CriticalShared = [ordered]@{}
foreach ($Shared in $Manifest.shared_files) {
    $Relative = [string]$Shared.path
    $Full = Join-Path $App2Root ($Relative -replace '/', '\')
    if (Test-Path $Full) {
        $CriticalShared[$Relative] = (Get-FileHash $Full -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

$Baseline = [ordered]@{
    baseline_version = 1
    checkpoint_id = "$Stamp-$SafeLabel"
    created_at = (Get-Date).ToString("o")
    label = $SafeLabel
    database = "psc_app2"
    counts = $Counts
    workflow_tables = $WorkflowTables
    critical_files = $CriticalShared
    protected_source_file_count = $CriticalFiles.Count
    git = [ordered]@{
        branch = $GitBranch
        commit = $GitCommit
        dirty = $GitDirty
    }
    checkpoint_path = $Checkpoint
    database_backup = $DbBackup
    source_backup = $SourceZip
}

Write-App2Json -Value $Baseline -Path (Join-Path $Checkpoint "baseline.json")
Write-App2Json -Value $Baseline -Path $BaselinePath

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " APP2 CHECKPOINT APPROVED" -ForegroundColor Green
Write-Host "=================================================="
Write-Host "Checkpoint: $Checkpoint"
Write-Host "Database:   $DbBackup"
Write-Host "Source:     $SourceZip"
Write-Host ""
Write-Host "Protected baseline counts:" -ForegroundColor Cyan
$Counts | Format-Table -AutoSize | Out-Host
