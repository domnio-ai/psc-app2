function Get-App2DatabaseUrl {
    param([string]$Backend)
    $EnvPath = Join-Path $Backend ".env"
    if (-not (Test-Path $EnvPath)) { throw "backend\.env not found: $EnvPath" }

    $DbLine = Get-Content $EnvPath |
        Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
        Select-Object -First 1

    if (-not $DbLine) { throw "DATABASE_URL not found in backend\.env" }

    return ($DbLine -replace '^\s*DATABASE_URL\s*=\s*','').Trim().Trim('"').Trim("'")
}

function Get-PostgresTool {
    param([Parameter(Mandatory=$true)][string]$Name)

    $Tool = Get-ChildItem "C:\Program Files\PostgreSQL" `
        -Recurse -Filter $Name -File -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        Select-Object -First 1

    if (-not $Tool) { throw "$Name could not be found under C:\Program Files\PostgreSQL." }
    return $Tool.FullName
}

function Get-App2CoreCounts {
    param(
        [Parameter(Mandatory=$true)][string]$Psql,
        [Parameter(Mandatory=$true)][string]$DatabaseUrl
    )

    $Sql = "SELECT (SELECT COUNT(*) FROM users),(SELECT COUNT(*) FROM assignments),(SELECT COUNT(*) FROM research_projects),(SELECT COUNT(*) FROM knowledge_items);"
    $Raw = & $Psql "--dbname=$DatabaseUrl" "-At" "-F" "|" "-v" "ON_ERROR_STOP=1" "-c" $Sql
    if ($LASTEXITCODE -ne 0) { throw "Could not read App2 core record counts." }

    $Line = ($Raw | Select-Object -Last 1).Trim()
    $Parts = $Line.Split("|")
    if ($Parts.Count -ne 4) { throw "Unexpected count query result: $Line" }

    return [ordered]@{
        users = [int64]$Parts[0]
        assignments = [int64]$Parts[1]
        research_projects = [int64]$Parts[2]
        documents = [int64]$Parts[3]
    }
}

function Get-App2ManagedFileHashes {
    param([Parameter(Mandatory=$true)][string]$App2Root)

    $Paths = @(
        (Join-Path $App2Root "src"),
        (Join-Path $App2Root "backend\src"),
        (Join-Path $App2Root "backend\migrations"),
        (Join-Path $App2Root "scripts\guard")
    )

    $Result = [ordered]@{}

    foreach ($Path in $Paths) {
        if (-not (Test-Path $Path)) { continue }

        Get-ChildItem $Path -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.FullName -notmatch '\\node_modules\\' -and
                $_.FullName -notmatch '\\dist\\' -and
                $_.FullName -notmatch '\\uploads\\'
            } |
            ForEach-Object {
                $Relative = $_.FullName.Substring($App2Root.Length).TrimStart('\').Replace('\','/')
                $Result[$Relative] = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            }
    }

    foreach ($Extra in @(
        "package.json",
        "package-lock.json",
        "vite.config.ts",
        "vite.config.js",
        "tsconfig.json",
        "APP2_FEATURE_CONTRACTS.md",
        "APP2_PROTECTED_MODULES.json"
    )) {
        $Full = Join-Path $App2Root $Extra
        if (Test-Path $Full) {
            $Result[$Extra.Replace('\','/')] = (Get-FileHash $Full -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }

    return $Result
}

function Write-App2Json {
    param(
        [Parameter(Mandatory=$true)]$Value,
        [Parameter(Mandatory=$true)][string]$Path,
        [int]$Depth = 20
    )
    $Value | ConvertTo-Json -Depth $Depth | Set-Content -Path $Path -Encoding UTF8
}
