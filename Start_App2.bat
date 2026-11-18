@echo off
setlocal EnableExtensions
title PSC App2 Launcher

set "APP_ROOT=%~dp0"
if "%APP_ROOT:~-1%"=="\" set "APP_ROOT=%APP_ROOT:~0,-1%"

echo.
echo ==========================================
echo              STARTING APP2
echo ==========================================
echo App2 root: %APP_ROOT%
echo.

where.exe powershell.exe >nul 2>&1
if errorlevel 1 (
    echo ERROR: Windows PowerShell was not found on PATH.
    echo Install or restore Windows PowerShell, then run this launcher again.
    pause
    exit /b 1
)
where.exe npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm was not found on PATH.
    echo Install Node.js with npm or correct PATH, then run this launcher again.
    pause
    exit /b 1
)

echo [1/3] Checking App2 API on port 8000...
set "API_NEEDS_START="
set "API_HEALTH_WARNING="
powershell -NoProfile -Command "$listeners=Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue; if(-not $listeners){exit 10}; $listener=$listeners | Select-Object -First 1; try{$health=Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 3}catch{Write-Host 'Port 8000 has a listener, but App2 API health did not respond.'; exit 11}; if($health.service -ne 'psc-app2-api'){Write-Host 'Port 8000 is occupied by a different service; refusing to stop it.'; exit 12}; if($health.capabilities.pscTaskReportPdf -eq $true -and $health.capabilities.pdfErrorDiagnostics -eq 'v4'){Write-Host 'Current App2 API build is already running.'; exit 0}; Write-Host 'An older App2 API is running. Close its console normally, then run this launcher again.'; exit 13"
set "API_CHECK_RESULT=%ERRORLEVEL%"
if "%API_CHECK_RESULT%"=="10" set "API_NEEDS_START=1"
if "%API_CHECK_RESULT%"=="11" (
    echo WARNING: Port 8000 has a listener, but App2 API health did not respond. No process was stopped.
    set "API_HEALTH_WARNING=1"
)
if "%API_CHECK_RESULT%"=="12" (
    echo WARNING: Port 8000 belongs to another service. It was left running; the API will not be started.
    set "API_HEALTH_WARNING=1"
)
if "%API_CHECK_RESULT%"=="13" (
    echo WARNING: An older App2 API is running. Close its console normally, then rerun this launcher to start the current API.
    set "API_HEALTH_WARNING=1"
)
if not "%API_CHECK_RESULT%"=="0" if not "%API_CHECK_RESULT%"=="10" if not "%API_CHECK_RESULT%"=="11" if not "%API_CHECK_RESULT%"=="12" if not "%API_CHECK_RESULT%"=="13" (
    echo WARNING: The App2 API check failed with code %API_CHECK_RESULT%. No existing process was stopped.
    set "API_HEALTH_WARNING=1"
)
if defined API_NEEDS_START start "App2 - API" /D "%APP_ROOT%\backend" cmd /k "npm start"

echo Felix is intentionally disabled; it will not be started by this launcher.
echo [2/3] Checking React frontend on port 5173...
powershell -NoProfile -Command "$listeners=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if(-not $listeners){exit 10}; $appRoot=[IO.Path]::GetFullPath($env:APP_ROOT).TrimEnd([IO.Path]::DirectorySeparatorChar); $viteEntry=[IO.Path]::GetFullPath((Join-Path $appRoot 'node_modules/vite/bin/vite.js')); $quote=[char]34; $vitePattern='(?i)(?:^|\s|'+[regex]::Escape([string]$quote)+')'+[regex]::Escape($viteEntry)+'(?:'+[regex]::Escape([string]$quote)+'|\s|$)'; $cimAvailable=$true; $identified=$false; try{foreach($listener in $listeners){$p=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$listener.OwningProcess) -ErrorAction Stop; if($p -and $p.Name -match '^node(\.exe)?$' -and $p.CommandLine -match $vitePattern){$identified=$true; break}}}catch{$cimAvailable=$false}; if($cimAvailable -and -not $identified){Write-Host 'Port 5173 is occupied, but its listener is not the App2 Vite executable.'; exit 12}; try{$page=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2; $vite=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/@vite/client' -TimeoutSec 2; if($page.StatusCode -eq 200 -and $page.Content -match '<title>REDESY \| PSC Research & Knowledge Management</title>' -and $page.Content -match '/src/main\.tsx' -and $vite.StatusCode -eq 200){exit 0}}catch{}; Write-Host 'Port 5173 is occupied, but App2 Vite identity could not be confirmed.'; exit 12"
set "FRONTEND_CHECK_RESULT=%ERRORLEVEL%"
if "%FRONTEND_CHECK_RESULT%"=="10" (
    start "App2 - Frontend" /D "%APP_ROOT%" cmd /k "npm run dev -- --host 127.0.0.1"
)
if "%FRONTEND_CHECK_RESULT%"=="12" (
    echo Port 5173 belongs to another process. It was left running; resolve the port conflict before starting App2.
    if defined API_NEEDS_START echo The App2 - API console may still be running. Press Ctrl+C there to stop it normally if desired.
    pause
    exit /b 1
)
if "%FRONTEND_CHECK_RESULT%"=="0" echo App2 Vite frontend already running.
if not "%FRONTEND_CHECK_RESULT%"=="0" if not "%FRONTEND_CHECK_RESULT%"=="10" (
    echo Frontend listener check failed with code %FRONTEND_CHECK_RESULT%.
    if defined API_NEEDS_START echo The App2 - API console may still be running. Press Ctrl+C there to stop it normally if desired.
    pause
    exit /b 1
)
echo Waiting for the App2 frontend...
set "FRONTEND_OK="
for /L %%G in (1,1,30) do (
    powershell -NoProfile -Command "$listeners=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if(-not $listeners){exit 1}; $appRoot=[IO.Path]::GetFullPath($env:APP_ROOT).TrimEnd([IO.Path]::DirectorySeparatorChar); $viteEntry=[IO.Path]::GetFullPath((Join-Path $appRoot 'node_modules/vite/bin/vite.js')); $quote=[char]34; $vitePattern='(?i)(?:^|\s|'+[regex]::Escape([string]$quote)+')'+[regex]::Escape($viteEntry)+'(?:'+[regex]::Escape([string]$quote)+'|\s|$)'; $cimAvailable=$true; $identified=$false; try{foreach($listener in $listeners){$p=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$listener.OwningProcess) -ErrorAction Stop; if($p -and $p.Name -match '^node(\.exe)?$' -and $p.CommandLine -match $vitePattern){$identified=$true; break}}}catch{$cimAvailable=$false}; if($cimAvailable -and -not $identified){exit 1}; try{$page=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2; $vite=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/@vite/client' -TimeoutSec 2; if($page.StatusCode -eq 200 -and $page.Content -match '<title>REDESY \| PSC Research & Knowledge Management</title>' -and $page.Content -match '/src/main\.tsx' -and $vite.StatusCode -eq 200){exit 0}else{exit 1}}catch{exit 1}; exit 1"
    if not errorlevel 1 (
        set "FRONTEND_OK=1"
        goto :frontend_ready
    )
    timeout /t 1 /nobreak >nul
)

:frontend_ready
if not defined FRONTEND_OK (
    echo ERROR: The frontend was not ready after 30 polling attempts; each request may wait up to 2 seconds plus a 1-second interval.
    echo Check the "App2 - Frontend" window and confirm the port is available.
    if defined FRONTEND_CHECK_RESULT if "%FRONTEND_CHECK_RESULT%"=="10" echo Press Ctrl+C in the App2 - Frontend console to stop it normally if desired.
    if defined API_NEEDS_START echo The App2 - API console may also still be running; press Ctrl+C there to stop it normally if desired.
    pause
    exit /b 1
)
echo Opening App2 in the default browser...
powershell -NoProfile -Command "try { Start-Process -FilePath 'http://127.0.0.1:5173/'; exit 0 } catch { exit 1 }"
if errorlevel 1 (
    echo PowerShell could not open the browser. Trying the Windows URL handler...
    start "" "http://127.0.0.1:5173/"
    if errorlevel 1 echo Browser launch failed. Open http://127.0.0.1:5173/ manually.
)

echo Waiting for App2 API health...
set "API_OK="
for /L %%G in (1,1,30) do (
    powershell -NoProfile -Command "try{$health=Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if($health.service -eq 'psc-app2-api' -and $health.capabilities.pscTaskReportPdf -eq $true -and $health.capabilities.pdfErrorDiagnostics -eq 'v4'){exit 0}else{exit 2}}catch{exit 1}"
    if not errorlevel 1 (
        set "API_OK=1"
        set "API_HEALTH_WARNING="
        goto :api_ready
    )
    timeout /t 1 /nobreak >nul
)

:api_ready
if not defined API_OK (
    echo.
    echo WARNING: App2 API identity/health was not confirmed on port 8000.
    echo The API check ended after 30 attempts; each request may wait up to 2 seconds plus a 1-second interval.
    echo Possible causes include database connectivity, backend configuration, or API startup failure.
    echo Review the "App2 - API" console for details; database credentials are not displayed here.
    set "API_HEALTH_WARNING=1"
    if defined API_NEEDS_START echo If you want to stop the API, press Ctrl+C in its console and allow it to exit normally.
    echo Research and Assignment actions may show Failed to fetch while the API is offline.
    echo.
) else (
    echo App2 API health check passed.
)

echo.
echo ==========================================
if defined API_HEALTH_WARNING (
    echo [3/3] Frontend opened; API needs attention.
) else (
    echo [3/3] Startup checks complete.
)
echo Frontend: http://127.0.0.1:5173
echo API:      http://127.0.0.1:8000
echo Felix:    intentionally disabled
echo ==========================================
echo.

exit /b 0
