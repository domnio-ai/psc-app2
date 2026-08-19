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
    timeout /t 2 /nobreak >nul
) else (
    echo Ollama already running.
)

echo [2/4] Starting App2 API on port 8000...
start "App2 - API" cmd /k "cd /d ""%APP_ROOT%\backend"" && npm start"

echo [3/4] Starting Felix on port 8100...
if exist "%AI_ROOT%\.venv\Scripts\python.exe" (
    start "App2 - Felix" cmd /k "cd /d ""%AI_ROOT%"" && "".venv\Scripts\python.exe"" -m uvicorn app.main:app --host 127.0.0.1 --port 8100"
) else (
    start "App2 - Felix" cmd /k "cd /d ""%AI_ROOT%"" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8100"
)

echo [4/4] Starting React frontend on port 5173...
start "App2 - Frontend" cmd /k "cd /d ""%APP_ROOT%"" && npm run dev -- --host 127.0.0.1"

timeout /t 5 /nobreak >nul

start "" "http://127.0.0.1:5173"

echo.
echo ==========================================
echo Frontend: http://127.0.0.1:5173
echo API:      http://127.0.0.1:8000
echo Felix:    http://127.0.0.1:8100
echo Ollama:   http://127.0.0.1:11434
echo ==========================================

exit /b 0
