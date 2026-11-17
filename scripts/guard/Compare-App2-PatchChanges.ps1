param(
    [Parameter(Mandatory=$true)][string]$BeforeHashMap,
    [Parameter(Mandatory=$true)][string]$PatchManifest,
    [string]$App2Root = "C:\Users\Admin\Documents\Codex\2026-07-28\referenced-chatgpt-conversation-this-is-untrusted\app2"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "App2Guard.Common.ps1")

if (-not (Test-Path $BeforeHashMap)) { throw "Before-change hash map not found: $BeforeHashMap" }
if (-not (Test-Path $PatchManifest)) { throw "Patch manifest not found: $PatchManifest" }

$BeforeObject = Get-Content $BeforeHashMap -Raw | ConvertFrom-Json
$Before = @{}
foreach ($Property in $BeforeObject.PSObject.Properties) {
    $Before[[string]$Property.Name] = [string]$Property.Value
}

$Patch = Get-Content $PatchManifest -Raw | ConvertFrom-Json
$After = Get-App2ManagedFileHashes -App2Root $App2Root

$Allowed = @{}
foreach ($Path in @($Patch.allowed_files)) {
    $Allowed[([string]$Path).Replace('\','/')] = $true
}

$AllPaths = New-Object System.Collections.Generic.HashSet[string]
foreach ($Key in $Before.Keys) { [void]$AllPaths.Add([string]$Key) }
foreach ($Key in $After.Keys) { [void]$AllPaths.Add([string]$Key) }

$Unexpected = @()
$Changed = @()

foreach ($Path in $AllPaths) {
    $OldHash = if ($Before.ContainsKey($Path)) { [string]$Before[$Path] } else { $null }
    $NewHash = if ($After.Contains($Path)) { [string]$After[$Path] } else { $null }

    if ($OldHash -ne $NewHash) {
        $Changed += $Path
        if (-not $Allowed.ContainsKey($Path)) {
            $Unexpected += $Path
        }
    }
}

Write-Host ""
Write-Host "Changed managed files:" -ForegroundColor Cyan
foreach ($Path in $Changed) { Write-Host "  $Path" }

if ($Unexpected.Count) {
    Write-Host ""
    Write-Host "UNDECLARED FILE CHANGES DETECTED:" -ForegroundColor Red
    foreach ($Path in $Unexpected) { Write-Host "  $Path" -ForegroundColor Red }
    throw "Patch modified files outside its declared allowlist."
}

Write-Host ""
Write-Host "PATCH FILE ALLOWLIST: PASSED" -ForegroundColor Green
