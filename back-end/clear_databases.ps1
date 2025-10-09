# Clear all database data for Cypher (Windows PowerShell)
# this will wipe everything - users, sessions, encrypted data, the works

param(
    [switch]$Force,
    [switch]$Help
)

if ($Help) {
    Write-Host "Cypher Database Cleaner for Windows" -ForegroundColor Green
    Write-Host "Usage: .\clear_databases.ps1 [-Force]" -ForegroundColor Yellow
    Write-Host "  -Force: skip confirmation prompt" -ForegroundColor Yellow
    Write-Host "WARNING: this will delete all your data!" -ForegroundColor Red
    exit 0
}

Write-Host "Database Cleaner" -ForegroundColor Red
Write-Host ""
Write-Host "this will completely wipe all database data including:" -ForegroundColor Yellow
Write-Host "- all user accounts and passwords" -ForegroundColor White
Write-Host "- all sessions and tokens" -ForegroundColor White
Write-Host "- all encrypted data" -ForegroundColor White
Write-Host "- all audit logs" -ForegroundColor White
Write-Host "- redis cache and sessions" -ForegroundColor White
Write-Host ""

if (!$Force) {
    $confirmation = Read-Host "are you absolutely sure? this cannot be undone (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Host "cancelled - probably a good choice" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "stopping application services..." -ForegroundColor Yellow
# try to kill any running flask/node processes
Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*flask*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*app.js*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "stopping database containers..." -ForegroundColor Yellow
docker compose stop postgres redis 2>$null

Write-Host "removing database containers and volumes..." -ForegroundColor Yellow
docker compose down -v 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "failed to stop containers - they might not be running" -ForegroundColor Yellow
}

Write-Host "cleaning up docker volumes..." -ForegroundColor Yellow
docker volume prune -f 2>$null

Write-Host "removing any leftover postgres data..." -ForegroundColor Yellow
if (Test-Path "postgres_data") {
    Remove-Item -Recurse -Force "postgres_data" -ErrorAction SilentlyContinue
}

if (Test-Path "redis_data") {
    Remove-Item -Recurse -Force "redis_data" -ErrorAction SilentlyContinue
}

Write-Host "clearing encryption keys..." -ForegroundColor Yellow
if (Test-Path ".keys") {
    Remove-Item -Recurse -Force ".keys" -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "database wipe complete!" -ForegroundColor Green
Write-Host ""
Write-Host "next steps:" -ForegroundColor Yellow
Write-Host "1. start fresh databases: docker compose up -d postgres redis" -ForegroundColor White
Write-Host "2. wait a few seconds for them to boot up" -ForegroundColor White
Write-Host "3. run database init: python migrations/init_db.py --all" -ForegroundColor White
Write-Host "4. start the app: .\start.ps1" -ForegroundColor White
Write-Host ""
Write-Host "or just run .\setup.ps1 to do it all automatically" -ForegroundColor Cyan
