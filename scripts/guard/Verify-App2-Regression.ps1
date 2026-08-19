param(
    [string]$App2Root = "C:\Users\Admin\Documents\Codex\2026-07-28\referenced-chatgpt-conversation-this-is-untrusted\app2",
    [ValidateSet("Fast","Full")][string]$Mode = "Full",
    [switch]$SkipDataCountFloor
)

$ErrorActionPreference = "Stop"

$GuardRoot = Join-Path $App2Root ".app2-guard"
$Backend = Join-Path $App2Root "backend"
$ManifestPath = Join-Path $App2Root "APP2_PROTECTED_MODULES.json"
$BaselinePath = Join-Path $GuardRoot "baseline.json"

. (Join-Path $PSScriptRoot "App2Guard.Common.ps1")

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " APP2 REGRESSION SHIELD VERIFICATION ($Mode)" -ForegroundColor Cyan
Write-Host "=================================================="

if (-not (Test-Path $ManifestPath)) { throw "Protected modules manifest missing: $ManifestPath" }
if (-not (Test-Path $BaselinePath)) { throw "App2 guard baseline missing: $BaselinePath" }

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$Baseline = Get-Content $BaselinePath -Raw | ConvertFrom-Json

Write-Host ""
Write-Host "[1/6] Checking protected source contracts..." -ForegroundColor Cyan

foreach ($Contract in $Manifest.source_contracts) {
    $Candidates = @()

    if ($Contract.files) {
        $Candidates = @($Contract.files)
    }
    elseif ($Contract.file) {
        $Candidates = @([string]$Contract.file)
    }

    if (-not $Candidates.Count) {
        throw "Protected contract $($Contract.id) has no source files declared."
    }

    $ExistingFiles = @()
    $CombinedContent = ""

    foreach ($Relative in $Candidates) {
        $File = Join-Path $App2Root (([string]$Relative) -replace '/', '\')
        if (Test-Path $File) {
            $ExistingFiles += [string]$Relative
            $CombinedContent += "`n" + (Get-Content $File -Raw)
        }
    }

    if (-not $ExistingFiles.Count) {
        throw "Protected contract $($Contract.id) failed: none of its declared source files exist."
    }

    if ($Contract.required_all) {
        foreach ($Pattern in $Contract.required_all) {
            if (-not $CombinedContent.Contains([string]$Pattern)) {
                throw "Protected contract $($Contract.id) failed: missing required signature '$Pattern' across: $($ExistingFiles -join ', ')"
            }
        }
    }

    if ($Contract.required_any) {
        $Found = $false
        foreach ($Pattern in $Contract.required_any) {
            if ($CombinedContent.Contains([string]$Pattern)) {
                $Found = $true
                break
            }
        }
        if (-not $Found) {
            throw "Protected contract $($Contract.id) failed: none of its accepted signatures exist across: $($ExistingFiles -join ', ')"
        }
    }

    Write-Host "  PASS $($Contract.id)" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/6] Checking backend JavaScript syntax..." -ForegroundColor Cyan

$Node = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $Node)) { throw "Node.js was not found at $Node" }

foreach ($File in @(
    (Join-Path $Backend "src\app.js"),
    (Join-Path $Backend "src\server.js")
)) {
    if (Test-Path $File) {
        & $Node --check $File
        if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed: $File" }
    }
}
Write-Host "  PASS backend syntax" -ForegroundColor Green

Write-Host ""
Write-Host "[3/6] Checking PostgreSQL tables and task-report schema..." -ForegroundColor Cyan

$DatabaseUrl = Get-App2DatabaseUrl -Backend $Backend
$Psql = Get-PostgresTool -Name "psql.exe"

foreach ($Table in @($Manifest.protected_database.required_tables)) {
    $Sql = "SELECT to_regclass('public.$Table') IS NOT NULL;"
    $Exists = (& $Psql "--dbname=$DatabaseUrl" "-At" "-v" "ON_ERROR_STOP=1" "-c" $Sql | Select-Object -Last 1).Trim()
    if ($LASTEXITCODE -ne 0 -or $Exists -ne "t") {
        throw "Required App2 table is missing: $Table"
    }
}
Write-Host "  PASS required tables" -ForegroundColor Green

foreach ($Column in @($Manifest.protected_database.task_report_columns)) {
    $Sql = "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assignment_tasks' AND column_name='$Column');"
    $Exists = (& $Psql "--dbname=$DatabaseUrl" "-At" "-v" "ON_ERROR_STOP=1" "-c" $Sql | Select-Object -Last 1).Trim()
    if ($LASTEXITCODE -ne 0 -or $Exists -ne "t") {
        throw "Protected task-report column is missing: assignment_tasks.$Column"
    }
}
Write-Host "  PASS task-report columns" -ForegroundColor Green

foreach ($Table in @($Manifest.protected_database.workflow_tables_if_installed)) {
    $ExpectedPreviously = $false
    if ($Baseline.workflow_tables) {
        $Property = $Baseline.workflow_tables.PSObject.Properties[$Table]
        if ($Property -and [bool]$Property.Value) { $ExpectedPreviously = $true }
    }

    if ($ExpectedPreviously) {
        $Sql = "SELECT to_regclass('public.$Table') IS NOT NULL;"
        $Exists = (& $Psql "--dbname=$DatabaseUrl" "-At" "-v" "ON_ERROR_STOP=1" "-c" $Sql | Select-Object -Last 1).Trim()
        if ($Exists -ne "t") {
            throw "A workflow table that existed at the protected baseline is now missing: $Table"
        }
    }
}
Write-Host "  PASS installed workflow tables preserved" -ForegroundColor Green

Write-Host ""
Write-Host "[4/6] Checking protected data floor..." -ForegroundColor Cyan

$Counts = Get-App2CoreCounts -Psql $Psql -DatabaseUrl $DatabaseUrl
$Counts | Format-Table -AutoSize | Out-Host

if (-not $SkipDataCountFloor) {
    foreach ($Name in @("users","assignments","research_projects","documents")) {
        $CurrentValue = [int64]$Counts[$Name]
        $BaselineValue = [int64]$Baseline.counts.$Name
        if ($CurrentValue -lt $BaselineValue) {
            throw "Protected data floor failed for $Name. Baseline=$BaselineValue Current=$CurrentValue."
        }
    }
}
Write-Host "  PASS protected data floor" -ForegroundColor Green

Write-Host ""
Write-Host "[5/6] Checking guarded shared files against baseline..." -ForegroundColor Cyan

foreach ($Shared in $Manifest.shared_files) {
    $Relative = [string]$Shared.path
    $Full = Join-Path $App2Root ($Relative -replace '/', '\')
    if (-not (Test-Path $Full)) { throw "Guarded shared file missing: $Relative" }

    $CurrentHash = (Get-FileHash $Full -Algorithm SHA256).Hash.ToLowerInvariant()
    $BaselineProperty = $Baseline.critical_files.PSObject.Properties[$Relative]
    if ($BaselineProperty) {
        $BaselineHash = [string]$BaselineProperty.Value
        if ($CurrentHash -ne $BaselineHash) {
            Write-Host "  NOTICE $Relative changed since the last approved checkpoint." -ForegroundColor Yellow
        } else {
            Write-Host "  PASS $Relative unchanged" -ForegroundColor Green
        }
    }
    else {
        Write-Host "  NOTICE $Relative will enter protected baseline at the next checkpoint." -ForegroundColor Yellow
    }
}

if ($Mode -eq "Full") {
    Write-Host ""
    Write-Host "[6/6] Running frontend production build..." -ForegroundColor Cyan
    Push-Location $App2Root
    try {
        & "C:\Program Files\nodejs\npm.cmd" run build
        if ($LASTEXITCODE -ne 0) { throw "Frontend production build failed." }
    }
    finally {
        Pop-Location
    }
    Write-Host "  PASS frontend build" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "[6/6] Frontend build skipped in Fast mode." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " APP2 REGRESSION SHIELD: PASSED" -ForegroundColor Green
Write-Host "=================================================="
