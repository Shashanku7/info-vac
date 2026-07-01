# InfoVac Services Launcher & Lifecycle Manager
$ErrorActionPreference = "Stop"

# Set CWD to the script folder
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "InfoVac Services Launcher" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Kill any leftover backend processes from previous runs
Write-Host "[0/3] Cleaning up any old backend processes..." -ForegroundColor DarkGray
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# Terminate any lingering PostgreSQL connections from old backend instances
# (Docker keeps TCP connections alive even after Python processes die)
try {
    $pgClean = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid != pg_backend_pid() AND datname = 'infovac';"
    docker exec infovac_postgres psql -U infovac -d infovac -c $pgClean | Out-Null
    Write-Host "[0/3] Stale DB connections cleared." -ForegroundColor DarkGray
} catch {}


# 1. Start Docker PostgreSQL
Write-Host "[1/3] Starting Docker database (PostgreSQL)..." -ForegroundColor Yellow
docker compose up -d postgres
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start Docker database. Make sure Docker Desktop is running!" -ForegroundColor Red
    Pause
    exit 1
}

# Wait for PostgreSQL to be ready to accept connections (prevents backend crash)
Write-Host "Waiting for database to accept connections..." -ForegroundColor Yellow
$portOpen = $false
for ($i = 1; $i -le 15; $i++) {
    $socket = New-Object Net.Sockets.TcpClient
    try {
        $connection = $socket.BeginConnect("127.0.0.1", 5432, $null, $null)
        $success = $connection.AsyncWaitHandle.WaitOne(1000)
        if ($success) {
            $socket.EndConnect($connection)
            $portOpen = $true
            break
        }
    }
    catch {}
    finally {
        if ($socket) { $socket.Close() }
    }
    Start-Sleep -Seconds 1
}
if (-not $portOpen) {
    Write-Host "[WARNING] Database port 5432 did not open within 15 seconds. Starting backend anyway..." -ForegroundColor DarkYellow
} else {
    Write-Host "Database is ready!" -ForegroundColor Green
}

# 2. Start FastAPI Backend in a new window
Write-Host "[2/3] Starting FastAPI Backend in a new window..." -ForegroundColor Yellow
$backend = Start-Process -FilePath "cmd.exe" -ArgumentList "/k title InfoVac Backend && call .\venv_infovac\Scripts\activate.bat && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000" -PassThru

# 3. Start Next.js Frontend in a new window
Write-Host "[3/3] Starting Next.js Frontend in a new window..." -ForegroundColor Yellow
$frontend = Start-Process -FilePath "cmd.exe" -ArgumentList "/k title InfoVac Frontend && cd frontend && npm run dev" -PassThru

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

    # Wait for the servers to initialize, then automatically open the frontend in the default browser
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:3000"

    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Shutdown-Services
}
