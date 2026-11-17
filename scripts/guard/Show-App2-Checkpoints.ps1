param(
    [string]$App2Root = "C:\Users\Admin\Documents\Codex\2026-07-28\referenced-chatgpt-conversation-this-is-untrusted\app2"
)

$Root = Join-Path $App2Root ".app2-guard\checkpoints"
if (-not (Test-Path $Root)) {
    Write-Host "No App2 Regression Shield checkpoints exist yet." -ForegroundColor Yellow
    exit 0
}

Get-ChildItem $Root -Directory |
    Sort-Object Name -Descending |
    Select-Object Name,LastWriteTime,FullName |
    Format-Table -AutoSize
