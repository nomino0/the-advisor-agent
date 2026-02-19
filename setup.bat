@echo off
echo ==========================================
echo    CloudWise AI - One-Click Setup
echo ==========================================

echo.
echo [1/3] Setting up Backend...
cd backend
python setup_env.py
if %errorlevel% neq 0 (
    echo [ERROR] Backend setup failed.
    pause
    exit /b %errorlevel%
)
cd ..

echo.
echo [2/3] Setting up Frontend...
cd frontend
if not exist node_modules (
    echo    - Installing npm dependencies...
    cmd /c npm install
) else (
    echo    - Node modules found, skipping install.
)
cd ..

echo.
echo [3/3] Setup Complete!
echo.
echo To start the application:
echo 1. Open a terminal for Backend:
echo    cd backend ^&^& uvicorn app.main:app --reload
echo.
echo 2. Open a terminal for Frontend:
echo    cd frontend ^&^& npm run dev
echo.
pause
