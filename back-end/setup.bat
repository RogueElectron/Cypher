@echo off
REM Cypher installation script for Windows (Batch version)
REM For users who can't run PowerShell scripts

echo.
echo =============================================
echo   Cypher Windows Setup (Batch Version)
echo =============================================
echo.

REM Check if we're in the right directory
if not exist "main.py" (
    echo [ERROR] main.py not found. Run this script from the back-end directory.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ERROR] package.json not found. Run this script from the back-end directory.
    pause
    exit /b 1
)

echo Checking prerequisites...

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install from https://python.org
    pause
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

REM Check npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found (comes with Node.js)
    pause
    exit /b 1
)

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker not found. Install Docker Desktop from https://docker.com
    pause
    exit /b 1
)

echo All prerequisites found!
echo.

echo Setting up Python virtual environment...

REM Check for existing virtual environments
if exist "venv\Scripts\activate.bat" (
    set VENV_PATH=venv
    echo Found existing virtual environment at venv
    goto :found_venv
)

if exist "..\venv\Scripts\activate.bat" (
    set VENV_PATH=..\venv
    echo Found existing virtual environment at ..\venv
    goto :found_venv
)

if exist "..\cyvenv\Scripts\activate.bat" (
    set VENV_PATH=..\cyvenv
    echo Found existing virtual environment at ..\cyvenv
    goto :found_venv
)

if exist "cyvenv\Scripts\activate.bat" (
    set VENV_PATH=cyvenv
    echo Found existing virtual environment at cyvenv
    goto :found_venv
)

REM Create new virtual environment
echo Creating new virtual environment at venv...
python -m venv venv
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment
    pause
    exit /b 1
)
set VENV_PATH=venv

:found_venv
echo Activating virtual environment...
call %VENV_PATH%\Scripts\activate.bat

echo Installing Python dependencies...
python -m pip install --upgrade pip >nul
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies
    pause
    exit /b 1
)

echo Installing Node.js dependencies...
npm install >nul
if errorlevel 1 (
    echo [ERROR] Failed to install Node.js dependencies
    pause
    exit /b 1
)

echo Installing internal API dependencies...
cd node_internal_api
npm install >nul
if errorlevel 1 (
    echo [ERROR] Failed to install internal API dependencies
    pause
    exit /b 1
)
cd ..

echo Building frontend assets...
npx vite build >nul
if errorlevel 1 (
    echo [ERROR] Failed to build frontend assets
    pause
    exit /b 1
)

echo Setting up environment configuration...
if not exist ".env" (
    if exist ".env.example" (
        echo Creating .env from .env.example...
        copy ".env.example" ".env" >nul
        
        echo [WARNING] Using default development secrets!
        echo [WARNING] For production, run: powershell -ExecutionPolicy Bypass -File generate_secrets.ps1
        echo [WARNING] Or manually update the secrets in .env file
    ) else (
        echo [ERROR] .env.example file not found
        pause
        exit /b 1
    )
) else (
    echo .env file already exists
)

echo Starting database services...
docker compose up -d postgres redis
if errorlevel 1 (
    echo [ERROR] Failed to start database services
    pause
    exit /b 1
)

echo Waiting for databases to be ready...
timeout /t 5 /nobreak >nul

echo Initializing database tables...
python migrations/init_db.py --all
if errorlevel 1 (
    echo [WARNING] Database may already be initialized
)

echo Creating startup batch files...

REM Create start.bat
echo @echo off > start.bat
echo echo Starting Cypher... >> start.bat
echo. >> start.bat
echo REM Check databases >> start.bat
echo docker compose ps ^| findstr "cypher-postgres" ^| findstr "Up" ^>nul >> start.bat
echo if errorlevel 1 ( >> start.bat
echo     echo Starting database services... >> start.bat
echo     docker compose up -d postgres redis >> start.bat
echo     timeout /t 5 /nobreak ^>nul >> start.bat
echo ^) >> start.bat
echo. >> start.bat
echo REM Find virtual environment >> start.bat
echo if exist "venv\Scripts\activate.bat" set VENV_PATH=venv >> start.bat
echo if exist "..\venv\Scripts\activate.bat" set VENV_PATH=..\venv >> start.bat
echo if exist "..\cyvenv\Scripts\activate.bat" set VENV_PATH=..\cyvenv >> start.bat
echo if exist "cyvenv\Scripts\activate.bat" set VENV_PATH=cyvenv >> start.bat
echo. >> start.bat
echo if not defined VENV_PATH ( >> start.bat
echo     echo [ERROR] Virtual environment not found. Run setup.bat first. >> start.bat
echo     pause >> start.bat
echo     exit /b 1 >> start.bat
echo ^) >> start.bat
echo. >> start.bat
echo call %%VENV_PATH%%\Scripts\activate.bat >> start.bat
echo. >> start.bat
echo echo Cypher running - Flask: http://127.0.0.1:5000 ^| Node: http://localhost:3000 >> start.bat
echo echo Access Cypher: http://localhost:5000 >> start.bat
echo echo Press Ctrl+C to stop >> start.bat
echo. >> start.bat
echo start /b python main.py >> start.bat
echo cd node_internal_api >> start.bat
echo start /b node app.js >> start.bat
echo cd .. >> start.bat
echo pause >> start.bat

echo.
echo =============================================
echo   Installation complete!
echo =============================================
echo.
echo Database services:
echo   PostgreSQL: localhost:5432
echo   Redis: localhost:6379
echo.
echo To start Cypher:
echo   start.bat     - production mode
echo   .\start.ps1   - PowerShell version (recommended)
echo.
echo To stop databases:
echo   docker compose down
echo.
echo [IMPORTANT] For production use, generate secure secrets:
echo   powershell -ExecutionPolicy Bypass -File generate_secrets.ps1
echo.
pause
