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
if not exist ".venv" (
    python -m venv .venv
)

echo.
echo [4/5] Installing requirements...
call .\.venv\Scripts\activate.bat
pip install -r requirements.txt

echo.
echo [5/5] Running Database Migrations...
alembic upgrade head

echo.
echo ==============================================
echo Setup Complete! 
echo.
echo NOTE: Make sure you have added your API keys to the .env file!
echo To run the server, use: .\.venv\Scripts\uvicorn.exe backend.main:app --reload
echo ==============================================
pause
