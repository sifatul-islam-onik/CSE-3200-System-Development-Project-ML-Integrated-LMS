@echo off
REM Start Multiple OCR ML Workers on Different Ports (Windows)
REM This script helps you run multiple ML server instances for load balancing

echo Starting OCR ML Worker Servers...
echo.

REM Configuration
set ML_SERVER_DIR=..\ml_server
set START_PORT=8001
set NUM_WORKERS=3

REM Check if ml_server directory exists
if not exist "%ML_SERVER_DIR%" (
    echo Error: ML server directory not found at %ML_SERVER_DIR%
    exit /b 1
)

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed
    exit /b 1
)

REM Start workers
set WORKER_COUNT=0
setlocal enabledelayedexpansion

(
for /L %%i in (1,1,%NUM_WORKERS%) do (
    set /a PORT=%START_PORT%+%%i-1
    set WORKER_NUM=%%i
    
    echo Starting Worker !WORKER_NUM! on port !PORT!...
    
    cd /d "%ML_SERVER_DIR%"
    start "ML Worker !WORKER_NUM!" cmd /k "set PORT=!PORT! && python app.py > ..\worker-!WORKER_NUM!.log 2>&1"
    cd /d "%~dp0"
    
    echo Worker !WORKER_NUM! started on port !PORT!
    echo.
    
    REM Give each worker a moment to start
    timeout /t 2 /nobreak >nul
)
)

echo ==========================================
echo All workers started successfully!
echo ==========================================
echo.
echo Worker URLs:
for /L %%i in (1,1,%NUM_WORKERS%) do (
    set /a PORT=%START_PORT%+%%i-1
    echo   Worker %%i: http://localhost:!PORT!
)

echo.
echo Logs:
for /L %%i in (1,1,%NUM_WORKERS%) do (
    echo   Worker %%i: worker-%%i.log
)

echo.
echo Add this to your .env file:
REM Build the comma-separated list
set URLS=
for /L %%i in (1,1,%NUM_WORKERS%) do (
    set /a PORT=%START_PORT%+%%i-1
    if !WORKER_COUNT! equ 0 (
        set URLS=http://localhost:!PORT!
    ) else (
        set URLS=!URLS!,http://localhost:!PORT!
    )
    set /a WORKER_COUNT+=1
)
echo ML_WORKER_URLS=!URLS!

echo.
echo ==========================================
echo To stop all workers, close the terminal windows
echo or use Task Manager to end Python processes
echo ==========================================
echo.

endlocal
pause
