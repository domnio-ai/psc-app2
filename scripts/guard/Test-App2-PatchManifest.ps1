param(
    [Parameter(Mandatory=$true)][string]$PatchManifest,
    [string]$App2Root = "C:\Users\Admin\Documents\Codex\2026-07-28\referenced-chatgpt-conversation-this-is-untrusted\app2"
)

$ErrorActionPreference = "Stop"

$GuardRoot = Join-Path $App2Root ".app2-guard"
$BaselinePath = Join-Path $GuardRoot "baseline.json"
$ProtectedPath = Join-Path $App2Root "APP2_PROTECTED_MODULES.json"

if (-not (Test-Path $PatchManifest)) { throw "Patch manifest not found: $PatchManifest" }
if (-not (Test-Path $BaselinePath)) { throw "App2 protected baseline not found. Create a checkpoint first." }
if (-not (Test-Path $ProtectedPath)) { throw "APP2_PROTECTED_MODULES.json is missing." }

$Patch = Get-Content $PatchManifest -Raw | ConvertFrom-Json
$Baseline = Get-Content $BaselinePath -Raw | ConvertFrom-Json
$Protected = Get-Content $ProtectedPath -Raw | ConvertFrom-Json

if ([int]$Patch.manifest_version -ne 1) { throw "Unsupported patch manifest version." }
if (-not $Patch.patch_id) { throw "Patch manifest must declare patch_id." }
if (-not $Patch.purpose) { throw "Patch manifest must declare purpose." }

$Allowed = @($Patch.allowed_files)
if (-not $Allowed.Count) { throw "Patch must declare at least one allowed file." }

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " APP2 PATCH GUARD: $($Patch.patch_id)" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host "Purpose: $($Patch.purpose)"
Write-Host ""

foreach ($Relative in $Allowed) {
    $Value = [string]$Relative

    if ([System.IO.Path]::IsPathRooted($Value) -or $Value -match '(^|[\\/])\.\.([\\/]|$)') {
        throw "Unsafe patch path: $Value"
    }

    Write-Host "  ALLOW $Value" -ForegroundColor Green
}

$SharedFiles = @{}
foreach ($Item in $Protected.shared_files) {
    $SharedFiles[[string]$Item.path] = $Item
}

$Overrides = @{}
foreach ($Override in @($Patch.protected_shared_file_overrides)) {
    $Overrides[[string]$Override.path] = $Override
}

foreach ($Relative in $Allowed) {
    $Value = ([string]$Relative).Replace('\','/')

    if ($SharedFiles.ContainsKey($Value)) {
        if (-not $Overrides.ContainsKey($Value)) {
            throw "Patch attempts to modify guarded shared file '$Value' without an explicit protected_shared_file_override."
        }

        $Override = $Overrides[$Value]
        if (-not $Override.reason) {
            throw "Guarded shared-file override for '$Value' requires a reason."
        }

        $BaselineProperty = $Baseline.critical_files.PSObject.Properties[$Value]
        if (-not $BaselineProperty) {
            throw "No approved baseline hash exists for guarded shared file '$Value'."
        }

        $CurrentFile = Join-Path $App2Root ($Value -replace '/', '\')
        if (-not (Test-Path $CurrentFile)) {
            throw "Guarded shared file does not exist: $Value"
        }

        $CurrentHash = (Get-FileHash $CurrentFile -Algorithm SHA256).Hash.ToLowerInvariant()
        $ApprovedHash = [string]$BaselineProperty.Value

        if ($CurrentHash -ne $ApprovedHash) {
            throw "Guarded shared file '$Value' has already changed since the approved checkpoint. Create/verify a new checkpoint before another patch touches it."
        }

        Write-Host "  GUARDED OVERRIDE APPROVED: $Value" -ForegroundColor Yellow
        Write-Host "    Reason: $($Override.reason)"
    }
}

if (@($Patch.database_migrations).Count -gt 0) {
    Write-Host ""
    Write-Host "Database migrations declared:" -ForegroundColor Yellow
    foreach ($Migration in @($Patch.database_migrations)) {
        Write-Host "  $Migration"
    }
    Write-Host "A pre-patch PostgreSQL checkpoint is mandatory before applying this patch." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "PATCH MANIFEST: APPROVED FOR PRE-PATCH CHECKPOINT" -ForegroundColor Green
