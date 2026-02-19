@echo off
REM ==========================================
REM CloudWise AI - System Health Check
REM Windows Batch Script
REM ==========================================

setlocal enabledelayedexpansion

REM Initialize counters
set /a pass=0
set /a fail=0
set /a warn=0

echo.
echo ============================
echo Health Check - CloudWise AI
echo ============================
echo.

REM Check Docker
echo [INFO] Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('docker --version') do set docker_version=%%i
    echo [OK] Docker found: !docker_version!
    set /a pass=pass+1
) else (
    echo [ERROR] Docker is not installed or not in PATH
    echo         Download from: https://www.docker.com/products/docker-desktop
    set /a fail=fail+1
)

REM Check Docker Compose
echo [INFO] Checking Docker Compose...
docker-compose --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('docker-compose --version') do set compose_version=%%i
    echo [OK] Docker Compose found: !compose_version!
    set /a pass=pass+1
) else (
    echo [ERROR] Docker Compose not found
    set /a fail=fail+1
)

REM Check if Docker daemon is running
echo [INFO] Checking if Docker daemon is running...
docker ps >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Docker daemon is running
    set /a pass=pass+1
) else (
    echo [ERROR] Docker daemon is not running
    echo         Please start Docker Desktop
    set /a fail=fail+1
)

REM Check .env file
echo [INFO] Checking .env configuration...
if exist .env (
    echo [OK] .env file found
    set /a pass=pass+1
    
    REM Check if OPENAI_API_KEY is set
    for /f "tokens=1,2 delims==" %%A in ('findstr "OPENAI_API_KEY" .env') do (
        set api_key=%%B
    )
    if "!api_key!"=="" (
        echo [WARNING] OPENAI_API_KEY is empty in .env
        set /a warn=warn+1
    ) else (
        echo [OK] OPENAI_API_KEY is configured
        set /a pass=pass+1
    )
) else (
    if exist .env.example (
        echo [WARNING] .env not found, but .env.example exists
        echo           Run: copy .env.example .env
        set /a warn=warn+1
    ) else (
        echo [ERROR] Neither .env nor .env.example found
        set /a fail=fail+1
    )
)

REM Check Container Status
echo [INFO] Checking running containers...
docker-compose ps >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('docker-compose ps --services --filter "status=running" 2^>nul ^| find /c /v ""') do set running=%%i
    echo [INFO] Found !running! running services
    set /a pass=pass+1
) else (
    echo [INFO] No containers running (might be first startup)
)

REM Check Disk Space
echo [INFO] Checking disk space...
REM This is a simplified check (C: drive)
for /f "tokens=4" %%a in ('dir /s c:\ 2^>nul ^| findstr bytes free') do (
    echo [OK] Disk space available
    set /a pass=pass+1
    goto disk_ok
)
echo [WARNING] Could not determine disk space
set /a warn=warn+1
:disk_ok

REM Check RAM
echo [INFO] Checking system RAM...
for /f "tokens=2 delims==" %%i in ('wmic os get totalvisiblememoryphysical /value 2^>nul') do (
    set ram_bytes=%%i
)
if not "!ram_bytes!"=="" (
    REM Convert bytes to GB
    set /a ram_gb=ram_bytes/1073741824
    echo [OK] Total RAM: !ram_gb! GB
    if !ram_gb! geq 4 (
        echo     (Meets minimum requirement of 4GB)
        set /a pass=pass+1
    ) else (
        echo [WARNING] RAM is less than recommended 4GB
        set /a warn=warn+1
    )
) else (
    echo [INFO] Could not detect RAM
)

REM Check Ports
echo [INFO] Checking port availability...

setlocal enabledelayedexpansion
for /f "tokens=*" %%i in ('netstat -ano 2^>nul ^| findstr ":3000 "') do (
    echo [WARNING] Port 3000 (Frontend) appears to be in use
    set /a warn=warn+1
    goto port_3000_check
)
echo [OK] Port 3000 (Frontend) is available
set /a pass=pass+1
:port_3000_check

for /f "tokens=*" %%i in ('netstat -ano 2^>nul ^| findstr ":8000 "') do (
    echo [WARNING] Port 8000 (Backend) appears to be in use
    set /a warn=warn+1
    goto port_8000_check
)
echo [OK] Port 8000 (Backend) is available
set /a pass=pass+1
:port_8000_check

for /f "tokens=*" %%i in ('netstat -ano 2^>nul ^| findstr ":5432 "') do (
    echo [WARNING] Port 5432 (PostgreSQL) appears to be in use
    set /a warn=warn+1
    goto port_5432_check
)
echo [OK] Port 5432 (PostgreSQL) is available
set /a pass=pass+1
:port_5432_check

REM Check Git
echo [INFO] Checking Git installation...
git --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('git --version') do set git_version=%%i
    echo [OK] Git found: !git_version!
    set /a pass=pass+1
) else (
    echo [WARNING] Git is not installed (optional)
    set /a warn=warn+1
)

REM Install docker-compose details
echo [INFO] Checking for required packages...

REM Check if curl is available (used in health checks)
curl --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] curl is available
    set /a pass=pass+1
) else (
    echo [WARNING] curl is not available (recommended for health checks)
    set /a warn=warn+1
)

REM Summary
echo.
echo ============================
echo Summary
echo ============================
echo.
echo Passed:   !pass!
echo Warnings: !warn!
echo Failed:   !fail!
echo.

if !fail! equ 0 (
    if !warn! equ 0 (
        echo [SUCCESS] All checks passed! Ready to deploy.
        echo.
        echo Next steps:
        echo   1. Configure .env values:
        echo      - Set OPENAI_API_KEY
        echo      - Update POSTGRES_PASSWORD if needed
        echo   2. Run: deploy.bat
        echo   3. Select option 1 to start services
        echo.
        exit /b 0
    ) else (
        echo [WARNING] Some warnings detected, but system might be ready.
        echo.
        echo Review the warnings above and fix if needed.
        echo.
        exit /b 0
    )
) else (
    echo [ERROR] Some critical checks failed!
    echo.
    echo Fix the errors above before proceeding.
    echo.
    exit /b 1
)
