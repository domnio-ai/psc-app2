param(
    [Parameter(Mandatory=$true)][string]$Session,
    [string]$App2Root = "C:\Users\Admin\Documents\Codex\2026-07-28\referenced-chatgpt-conversation-this-is-untrusted\app2"
)

$ErrorActionPreference = "Stop"

$Before = Join-Path $Session "before-hashes.json"
$Manifest = Join-Path $Session "APP2_PATCH_MANIFEST.json"

if (-not (Test-Path $Before)) { throw "Guard session before-hashes.json is missing." }
if (-not (Test-Path $Manifest)) { throw "Guard session patch manifest is missing." }

& (Join-Path $PSScriptRoot "Compare-App2-PatchChanges.ps1") `
    -BeforeHashMap $Before `
    -PatchManifest $Manifest `
    -App2Root $App2Root

if ($LASTEXITCODE -ne 0) { throw "Patch changed undeclared files." }

& (Join-Path $PSScriptRoot "Verify-App2-Regression.ps1") -App2Root $App2Root -Mode Full
if ($LASTEXITCODE -ne 0) { throw "Regression verification failed. Do not approve this patch." }

$Patch = Get-Content $Manifest -Raw | ConvertFrom-Json

& (Join-Path $PSScriptRoot "New-App2-Checkpoint.ps1") `
    -App2Root $App2Root `
    -Label "after-$($Patch.patch_id)"

if ($LASTEXITCODE -ne 0) { throw "Post-patch checkpoint failed." }

"APPROVED" | Set-Content (Join-Path $Session "status.txt") -Encoding ASCII

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " PATCH PASSED REGRESSION SHIELD AND IS APPROVED" -ForegroundColor Green
Write-Host "=================================================="
