@echo off
REM ==========================================
REM CloudWise AI - Docker Deployment Script
REM Windows PowerShell/CMD Script
REM ==========================================

setlocal enabledelayedexpansion

REM Colors for output (if supported)
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "RESET=[0m"

REM Check if Docker is installed
echo Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%Error: Docker is not installed or not in PATH%RESET%
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%Error: Docker Compose is not installed%RESET%
    echo Please install Docker Desktop (includes Docker Compose)
    pause
    exit /b 1
)

echo %GREEN%Docker and Docker Compose found%RESET%

REM Check if .env file exists
if not exist .env (
    echo %YELLOW%Note: .env file not found%RESET%
    if exist .env.example (
        echo Creating .env from .env.example...
        copy .env.example .env >nul
        echo %GREEN%.env file created. Please review and update it as needed.%RESET%
    ) else (
        echo %RED%Error: Neither .env nor .env.example found%RESET%
        pause
        exit /b 1
    )
)

echo.
echo %GREEN%======================================%RESET%
echo %GREEN%CloudWise AI - Docker Menu%RESET%
echo %GREEN%======================================%RESET%
echo.
echo 1 - Start all services (docker-compose up -d)
echo 2 - Stop all services (docker-compose down)
echo 3 - View logs (follow mode)
echo 4 - View backend logs only
echo 5 - View frontend logs only
echo 6 - Rebuild images (docker-compose build)
echo 7 - Health check
echo 8 - Reset everything (remove containers and volumes)
echo 9 - Open in browser
echo 10 - Exit
echo.

set /p choice="Enter your choice (1-10): "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto logs
if "%choice%"=="4" goto logs_backend
if "%choice%"=="5" goto logs_frontend
if "%choice%"=="6" goto rebuild
if "%choice%"=="7" goto health
if "%choice%"=="8" goto reset
if "%choice%"=="9" goto browser
if "%choice%"=="10" exit /b 0

echo %RED%Invalid choice%RESET%
pause
cls
goto menu

:start
echo.
echo %GREEN%Starting all services...%RESET%
docker-compose up -d
if %errorlevel% equ 0 (
    echo.
    echo %GREEN%Services started successfully!%RESET%
    echo.
    echo Frontend: http://localhost:3000
    echo Backend:  http://localhost:8000
    echo API Docs: http://localhost:8000/docs
    echo.
    echo Run 'docker-compose logs' to view logs
) else (
    echo %RED%Error starting services%RESET%
)
pause
cls
goto menu

:stop
echo.
echo %GREEN%Stopping all services...%RESET%
docker-compose down
if %errorlevel% equ 0 (
    echo %GREEN%Services stopped successfully%RESET%
) else (
    echo %RED%Error stopping services%RESET%
)
pause
cls
goto menu

:logs
echo.
echo %GREEN%Displaying all service logs (Ctrl+C to exit)%RESET%
docker-compose logs -f
cls
goto menu

:logs_backend
echo.
echo %GREEN%Displaying backend logs (Ctrl+C to exit)%RESET%
docker-compose logs -f backend
cls
goto menu

:logs_frontend
echo.
echo %GREEN%Displaying frontend logs (Ctrl+C to exit)%RESET%
docker-compose logs -f frontend
cls
goto menu

:rebuild
echo.
echo %GREEN%Rebuilding Docker images...%RESET%
docker-compose build --no-cache
if %errorlevel% equ 0 (
    echo %GREEN%Images rebuilt successfully%RESET%
) else (
    echo %RED%Error rebuilding images%RESET%
)
pause
cls
goto menu

:health
echo.
echo %GREEN%Checking service health...%RESET%
echo.

echo Checking services status...
docker-compose ps
echo.

echo Testing backend health: http://localhost:8000/api/v1/health
curl -s http://localhost:8000/api/v1/health >nul
if %errorlevel% equ 0 (
    echo %GREEN%[OK] Backend is healthy%RESET%
) else (
    echo %YELLOW%[PENDING] Backend starting...%RESET%
)
echo.

echo Testing frontend health: http://localhost:3000
curl -s http://localhost:3000 >nul
if %errorlevel% equ 0 (
    echo %GREEN%[OK] Frontend is healthy%RESET%
) else (
    echo %YELLOW%[PENDING] Frontend starting...%RESET%
)
echo.

echo Testing database connection...
docker exec cloudwise-postgres pg_isready -U cloudwise -d cloudwise_db >nul 2>&1
if %errorlevel% equ 0 (
    echo %GREEN%[OK] Database is healthy%RESET%
) else (
    echo %RED%[ERROR] Database connection failed%RESET%
)
echo.

echo Testing Redis connection...
docker exec cloudwise-redis redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    echo %GREEN%[OK] Redis is healthy%RESET%
) else (
    echo %RED%[ERROR] Redis connection failed%RESET%
)
echo.

pause
cls
goto menu

:reset
echo.
echo %YELLOW%WARNING: This will delete all containers and volumes!%RESET%
echo All data will be lost.
echo.
set /p confirm="Are you sure? (yes/no): "
if /i "%confirm%"=="yes" (
    echo %GREEN%Removing all containers and volumes...%RESET%
    docker-compose down -v
    if %errorlevel% equ 0 (
        echo %GREEN%Everything reset successfully%RESET%
    ) else (
        echo %RED%Error during reset%RESET%
    )
) else (
    echo %YELLOW%Reset cancelled%RESET%
)
pause
cls
goto menu

:browser
echo.
echo %GREEN%Opening CloudWise AI in browser...%RESET%
start http://localhost:3000
cls
goto menu

:menu
cls
goto start
