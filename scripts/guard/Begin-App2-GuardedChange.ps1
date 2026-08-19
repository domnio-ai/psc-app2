param(
    [Parameter(Mandatory=$true)][string]$PatchManifest,
    [string]$App2Root = "C:\Users\Admin\Documents\Codex\2026-07-28\referenced-chatgpt-conversation-this-is-untrusted\app2"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "App2Guard.Common.ps1")

& (Join-Path $PSScriptRoot "Verify-App2-Regression.ps1") -App2Root $App2Root -Mode Full
if ($LASTEXITCODE -ne 0) { throw "Current App2 baseline failed verification. Patch blocked." }

& (Join-Path $PSScriptRoot "Test-App2-PatchManifest.ps1") -PatchManifest $PatchManifest -App2Root $App2Root
if ($LASTEXITCODE -ne 0) { throw "Patch manifest failed guard validation." }

$Patch = Get-Content $PatchManifest -Raw | ConvertFrom-Json
$Label = "before-$($Patch.patch_id)"

& (Join-Path $PSScriptRoot "New-App2-Checkpoint.ps1") -App2Root $App2Root -Label $Label
if ($LASTEXITCODE -ne 0) { throw "Pre-patch checkpoint failed. Patch blocked." }

$SessionRoot = Join-Path $App2Root ".app2-guard\patch-sessions"
New-Item -ItemType Directory -Path $SessionRoot -Force | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Session = Join-Path $SessionRoot "$Stamp-$($Patch.patch_id)"
New-Item -ItemType Directory -Path $Session -Force | Out-Null

$Hashes = Get-App2ManagedFileHashes -App2Root $App2Root
Write-App2Json -Value $Hashes -Path (Join-Path $Session "before-hashes.json")
Copy-Item $PatchManifest (Join-Path $Session "APP2_PATCH_MANIFEST.json") -Force

Write-Host ""
Write-Host "APP2 GUARDED PATCH SESSION READY" -ForegroundColor Green
Write-Host "Session: $Session"
Write-Host ""
Write-Host "After the patch is applied, run Complete-App2-GuardedChange.ps1 with this session path."
