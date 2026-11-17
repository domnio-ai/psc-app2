@echo off
setlocal EnableExtensions
title PSC App2 Launcher

set "APP_ROOT=%~dp0"
if "%APP_ROOT:~-1%"=="\" set "APP_ROOT=%APP_ROOT:~0,-1%"
set "AI_ROOT=%APP_ROOT%\..\ai-research-service"

echo.
echo ==========================================
echo              STARTING APP2
echo ==========================================
echo App2 root: %APP_ROOT%
echo.

echo [1/4] Checking Ollama...
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
    echo Starting Ollama...
    start "App2 - Ollama" /min cmd /k "ollama serve"
    timeout /t 3 /nobreak >nul
) else (
    echo Ollama already running.
)

echo [2/4] Starting App2 API on port 8000...
set "API_NEEDS_START="
powershell -NoProfile -Command "$listener=Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if(-not $listener){exit 10}; try{$health=Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 3}catch{exit 11}; if($health.service -ne 'psc-app2-api'){Write-Host 'Port 8000 is occupied by a different service; refusing to stop it.'; exit 12}; if($health.capabilities.pscTaskReportPdf -eq $true -and $health.capabilities.pdfErrorDiagnostics -eq 'v4'){Write-Host 'Current App2 API build is already running.'; exit 0}; $process=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$listener.OwningProcess) -ErrorAction SilentlyContinue; if(-not $process -or $process.Name -notmatch '^node(\.exe)?$' -or $process.CommandLine -notmatch 'server\.js'){Write-Host 'App2 API build is stale, but its process could not be safely identified. Close the App2 - API window and run this launcher again.'; exit 13}; Stop-Process -Id $listener.OwningProcess -Force; Start-Sleep -Seconds 2; exit 10"
if errorlevel 10 set "API_NEEDS_START=1"
if errorlevel 11 (
    echo Existing process on port 8000 is not responding as App2. Close that stale process before restarting App2.
    pause
    exit /b 1
)
if errorlevel 12 (
    echo Port 8000 belongs to another service. It was left running; resolve the port conflict before starting App2.
    pause
    exit /b 1
)
if errorlevel 13 (
    echo The old App2 API could not be safely restarted automatically.
    pause
    exit /b 1
)
if defined API_NEEDS_START start "App2 - API" /D "%APP_ROOT%\backend" cmd /k "npm start"

echo Waiting for App2 API health...
set "API_OK="
for /L %%G in (1,1,30) do (
    powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
    if not errorlevel 1 (
        set "API_OK=1"
        goto :api_ready
    )
    timeout /t 1 /nobreak >nul
)

:api_ready
if not defined API_OK (
    echo.
    echo ERROR: App2 API did not become healthy on port 8000.
    echo Check the "App2 - API" window before opening the frontend.
    echo Research and Assignment actions will show Failed to fetch while the API is offline.
    echo.
    pause
    exit /b 1
) else (
    echo App2 API health check passed.
)

echo [3/4] Starting Felix on port 8100...

set "FELIX_OK="

powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8100/api/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1

if not errorlevel 1 (
    echo Felix already running and healthy.
    set "FELIX_OK=1"
)

if not defined FELIX_OK (
    if not exist "%AI_ROOT%\run_felix.py" (
        echo.
        echo ERROR: Felix launcher was not found:
        echo   %AI_ROOT%\run_felix.py
        echo.
        echo Repository indexing and Felix document intelligence are unavailable.
        echo.
        goto :felix_failed
    )

    if exist "%AI_ROOT%\.venv\Scripts\python.exe" (
        echo Starting Felix with its virtual environment...
        start "App2 - Felix" /D "%AI_ROOT%" cmd /k ""%AI_ROOT%\.venv\Scripts\python.exe" "%AI_ROOT%\run_felix.py""
    )

    if not exist "%AI_ROOT%\.venv\Scripts\python.exe" (
        echo Felix virtual environment was not found. Trying system Python...
        start "App2 - Felix" /D "%AI_ROOT%" cmd /k "python "%AI_ROOT%\run_felix.py""
    )

    echo Waiting for Felix health...

    for /L %%G in (1,1,30) do (
        powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8100/api/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1

        if not errorlevel 1 (
            set "FELIX_OK=1"
            goto :felix_ready
        )

        timeout /t 1 /nobreak >nul
    )
)

:felix_ready

if defined FELIX_OK (
    echo Felix health check passed.
    goto :felix_complete
)

:felix_failed
echo.
echo ============================================================
echo WARNING: FELIX IS OFFLINE
echo ============================================================
echo App2 will continue to start, but these features are degraded:
echo   - Repository document indexing
echo   - Ask Felix on repository documents
echo   - Felix document assessment and evidence retrieval
echo.
echo Check the "App2 - Felix" window for the startup error.
echo ============================================================
echo.

:felix_complete
echo [4/4] Starting React frontend on port 5173...
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)) { exit 1 } else { exit 0 }"
if errorlevel 1 (
    start "App2 - Frontend" /D "%APP_ROOT%" cmd /k "npm run dev -- --host 127.0.0.1"
) else (
    echo React frontend already running.
)

timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:5173"

echo.
echo ==========================================
echo Frontend: http://127.0.0.1:5173
echo API:      http://127.0.0.1:8000
echo Felix:    http://127.0.0.1:8100
echo Ollama:   http://127.0.0.1:11434
echo ==========================================
echo.

exit /b 0
