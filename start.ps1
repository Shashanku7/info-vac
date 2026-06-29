# InfoVac Services Launcher & Lifecycle Manager
$ErrorActionPreference = "Stop"

# Set CWD to the script folder
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "InfoVac Services Launcher" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Start Docker PostgreSQL
Write-Host "[1/3] Starting Docker database (PostgreSQL)..." -ForegroundColor Yellow
docker compose up -d postgres
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start Docker database. Make sure Docker Desktop is running!" -ForegroundColor Red
    Pause
    exit 1
}

# 2. Start FastAPI Backend in a new window
Write-Host "[2/3] Starting FastAPI Backend in a new window..." -ForegroundColor Yellow
$backend = Start-Process -FilePath "cmd.exe" -ArgumentList "/c title InfoVac Backend && call .\venv_infovac\Scripts\activate.bat && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload" -PassThru

# 3. Start Next.js Frontend in a new window
Write-Host "[3/3] Starting Next.js Frontend in a new window..." -ForegroundColor Yellow
$frontend = Start-Process -FilePath "cmd.exe" -ArgumentList "/c title InfoVac Frontend && cd frontend && npm run dev" -PassThru

# Cleanup function to kill background processes on exit
function Shutdown-Services {
    Write-Host "`nStopping background processes..." -ForegroundColor DarkYellow
    if ($backend) {
        taskkill /f /t /pid $backend.Id 2>&1 | Out-Null
    }
    if ($frontend) {
        taskkill /f /t /pid $frontend.Id 2>&1 | Out-Null
    }
    Write-Host "InfoVac services stopped successfully." -ForegroundColor Green
}

# Monitor loop and catch termination (Ctrl+C)
try {
    Write-Host "`nInfoVac services are now running!" -ForegroundColor Green
    Write-Host "- Backend: http://localhost:8000" -ForegroundColor Gray
    Write-Host "- Frontend: http://localhost:3000" -ForegroundColor Gray
    Write-Host "`n>>> Press Ctrl+C in this window to stop both servers and clean up! <<<`n" -ForegroundColor Cyan

    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Shutdown-Services
}
