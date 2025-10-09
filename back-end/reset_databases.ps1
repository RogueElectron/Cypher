# Reset databases with fresh data for Cypher (Windows PowerShell)
# this clears everything and reinitializes - good for testing

param(
    [switch]$Force,
    [switch]$Help
)

if ($Help) {
    Write-Host "Cypher Database Reset for Windows" -ForegroundColor Green
    Write-Host "Usage: .\reset_databases.ps1 [-Force]" -ForegroundColor Yellow
    Write-Host "  -Force: skip confirmation and auto-reinitialize" -ForegroundColor Yellow
    Write-Host "this clears data and reinitializes everything" -ForegroundColor Yellow
    exit 0
}

Write-Host "Database Reset Tool" -ForegroundColor Cyan
Write-Host ""
Write-Host "this will:" -ForegroundColor Yellow
Write-Host "1. wipe all existing data" -ForegroundColor White
Write-Host "2. restart database containers" -ForegroundColor White  
Write-Host "3. reinitialize tables and schemas" -ForegroundColor White
Write-Host "4. ready for fresh use" -ForegroundColor White
Write-Host ""

if (!$Force) {
    $confirmation = Read-Host "continue with reset? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Host "cancelled" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "step 1: clearing existing data..." -ForegroundColor Yellow
& ".\clear_databases.ps1" -Force

Write-Host ""
Write-Host "step 2: starting fresh database containers..." -ForegroundColor Yellow
docker compose up -d postgres redis

if ($LASTEXITCODE -ne 0) {
    Write-Host "failed to start databases - check docker desktop" -ForegroundColor Red
    exit 1
}

Write-Host "waiting for databases to boot up..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

Write-Host ""
Write-Host "step 3: checking if virtual environment exists..." -ForegroundColor Yellow
$venvPaths = @(".\venv", "..\venv", "..\cyvenv", ".\cyvenv")
$venvPath = ""
foreach ($path in $venvPaths) {
    if ((Test-Path $path) -and (Test-Path "$path\Scripts\activate.ps1")) {
        $venvPath = $path
        break
    }
}

if ($venvPath -eq "") {
    Write-Host "no virtual environment found - run setup.ps1 first" -ForegroundColor Red
    exit 1
}

Write-Host "activating virtual environment at $venvPath..." -ForegroundColor Yellow
& "$venvPath\Scripts\Activate.ps1"

Write-Host ""
Write-Host "step 4: initializing database tables..." -ForegroundColor Yellow
python migrations/init_db.py --all

if ($LASTEXITCODE -ne 0) {
    Write-Host "database initialization failed - check the logs above" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "database reset complete!" -ForegroundColor Green
Write-Host ""
Write-Host "databases are running and initialized:" -ForegroundColor Cyan
Write-Host "- postgresql: localhost:5432" -ForegroundColor White
Write-Host "- redis: localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "ready to start cypher:" -ForegroundColor Yellow
Write-Host ".\start.ps1 - production mode" -ForegroundColor White
Write-Host ".\dev.ps1   - development mode" -ForegroundColor White
