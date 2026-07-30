$ErrorActionPreference = "Stop"

$securePassword = Read-Host "Enter the password you assigned to the psc_app2 PostgreSQL role" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $encodedPassword = [Uri]::EscapeDataString($plainPassword)
    $jwtBytes = New-Object byte[] 48
    $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    $randomGenerator.GetBytes($jwtBytes)
    $randomGenerator.Dispose()
    $jwtSecret = ([BitConverter]::ToString($jwtBytes) -replace "-", "").ToLowerInvariant()

    $environment = @"
PORT=8000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://psc_app2:$encodedPassword@localhost:5432/psc_app2
DATABASE_SSL=false
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=8h
"@

    Set-Content -LiteralPath (Join-Path $PSScriptRoot ".env") -Value $environment -Encoding utf8
    Write-Host "Private backend configuration created."
    & "C:\Program Files\nodejs\npm.cmd" run db:setup
    if ($LASTEXITCODE -ne 0) { throw "Database setup did not complete." }
    Write-Host "PSC App2 database initialization completed successfully."
}
finally {
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    $plainPassword = $null
    $securePassword = $null
}
