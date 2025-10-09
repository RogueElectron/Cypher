@echo off
REM Clear all database data for Cypher (Windows Batch)
REM this will wipe everything - users, sessions, encrypted data, the works

echo.
echo =============================================
echo   Database Cleaner (Batch Version)
echo =============================================
echo.

echo this will completely wipe all database data including:
echo - all user accounts and passwords
echo - all sessions and tokens  
echo - all encrypted data
echo - all audit logs
echo - redis cache and sessions
echo.

set /p confirm="are you absolutely sure? this cannot be undone (y/N): "
if /i not "%confirm%"=="y" (
    echo cancelled - probably a good choice
    pause
    exit /b 0
)

echo.
echo stopping application services...
REM try to kill any running python/node processes
taskkill /f /im python.exe /fi "WINDOWTITLE eq *flask*" >nul 2>&1
taskkill /f /im node.exe >nul 2>&1

echo stopping database containers...
docker compose stop postgres redis >nul 2>&1

echo removing database containers and volumes...
docker compose down -v >nul 2>&1

echo cleaning up docker volumes...
docker volume prune -f >nul 2>&1

echo removing any leftover data directories...
if exist "postgres_data" (
    rmdir /s /q "postgres_data" >nul 2>&1
)

if exist "redis_data" (
    rmdir /s /q "redis_data" >nul 2>&1
)

echo clearing encryption keys...
if exist ".keys" (
    rmdir /s /q ".keys" >nul 2>&1
)

echo.
echo =============================================
echo   database wipe complete!
echo =============================================
echo.
echo next steps:
echo 1. start fresh databases: docker compose up -d postgres redis
echo 2. wait a few seconds for them to boot up
echo 3. run database init: python migrations/init_db.py --all
echo 4. start the app: start.bat or .\start.ps1
echo.
echo or just run setup.bat to do it all automatically
echo.
pause
