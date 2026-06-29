@echo off
echo ==============================================
echo Info-Vac Developer Setup
echo ==============================================

echo [1/5] Checking for .env file...
if not exist ".env" (
    echo Creating .env from .env.example...
    copy .env.example .env
    echo WARNING: You must fill out your API keys in the .env file!
) else (
    echo .env file already exists!
)

echo.
echo [2/5] Checking Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running!
    echo Please open Docker Desktop, wait for it to start, and run this script again.
    pause
    exit /b
)
echo Docker is running! Starting PostgreSQL container...
docker compose up -d

echo.
echo [3/5] Setting up Python Virtual Environment...
if not exist "venv_infovac" (
    python -m venv venv_infovac
)

echo.
echo [4/5] Installing requirements...
call .\venv_infovac\Scripts\activate.bat
pip install -r requirements.txt

echo.
echo [5/6] Checking Node.js and Installing Frontend Dependencies...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Node.js is not installed!
    echo Please install Node.js (v18+) to run the frontend app: https://nodejs.org/
) else (
    echo Node.js is installed. Installing frontend packages...
    cd frontend
    call npm install
    cd ..
)

echo.
echo [6/6] Running Database Migrations...
alembic upgrade head

echo.
echo ==============================================
echo Setup Complete! 
echo.
echo NOTE: Make sure you have added your API keys to the .env file!
echo To start all services, use: .\start.bat
echo ==============================================
pause
