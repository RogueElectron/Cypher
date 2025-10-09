# Cypher installation script for Windows
# Installs all dependencies for the authentication platform

param(
    [switch]$Help
)

if ($Help) {
    Write-Host "Cypher Setup Script for Windows" -ForegroundColor Green
    Write-Host "Usage: .\setup.ps1" -ForegroundColor Yellow
    Write-Host "Prerequisites: Python 3, Node.js, npm, Docker Desktop" -ForegroundColor Yellow
    exit 0
}

# Function to write colored output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Function to check if command exists
function Test-Command($command) {
    try {
        Get-Command $command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

Write-Host "🔧 Cypher Windows Setup Starting..." -ForegroundColor Green

# Check if we're in the right directory
if (!(Test-Path "main.py") -or !(Test-Path "package.json")) {
    Write-Host "❌ Error: Run this script from the back-end directory" -ForegroundColor Red
    exit 1
}

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (!(Test-Command "python")) {
    Write-Host "❌ Error: Python required. Install from https://python.org" -ForegroundColor Red
    exit 1
}

if (!(Test-Command "node")) {
    Write-Host "❌ Error: Node.js required. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

if (!(Test-Command "npm")) {
    Write-Host "❌ Error: npm required (comes with Node.js)" -ForegroundColor Red
    exit 1
}

if (!(Test-Command "docker")) {
    Write-Host "❌ Error: Docker Desktop required for database services" -ForegroundColor Red
    Write-Host "Install from https://docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

Write-Host "Setting up Python environment..." -ForegroundColor Yellow

# Find or create virtual environment
$venvPaths = @(".\venv", "..\venv", "..\cyvenv", ".\cyvenv")
$venvPath = ""

# Check for existing virtual environment
foreach ($path in $venvPaths) {
    if ((Test-Path $path) -and (Test-Path "$path\Scripts\activate.ps1")) {
        $venvPath = $path
        Write-Host "Found existing virtual environment at $venvPath" -ForegroundColor Green
        break
    }
}

# Create new virtual environment if none found
if ($venvPath -eq "") {
    $venvPath = ".\venv"
    Write-Host "Creating virtual environment at $venvPath..." -ForegroundColor Yellow
    python -m venv $venvPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create virtual environment" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "$venvPath\Scripts\Activate.ps1"

Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip | Out-Null

Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Python dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "Installing main backend dependencies..." -ForegroundColor Yellow
npm install | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Node.js dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "Installing internal API dependencies..." -ForegroundColor Yellow
Set-Location node_internal_api
npm install | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install internal API dependencies" -ForegroundColor Red
    exit 1
}
Set-Location ..

Write-Host "Building frontend assets..." -ForegroundColor Yellow
npx vite build | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build frontend assets" -ForegroundColor Red
    exit 1
}

Write-Host "Setting up environment configuration..." -ForegroundColor Yellow
if (!(Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "Creating .env file from .env.example..." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
        
        # Update KEY_STORE_PATH to current directory
        $currentDir = (Get-Location).Path
        $envContent = Get-Content ".env" -Raw
        $envContent = $envContent -replace "KEY_STORE_PATH=.*", "KEY_STORE_PATH=$currentDir\.keys"
        
        Write-Host "Generating secure secrets..." -ForegroundColor Yellow
        
        # Generate secure random secrets using Python
        $masterPassword = python -c "import secrets; print(secrets.token_urlsafe(32))"
        $dbPassword = python -c "import secrets; print(secrets.token_urlsafe(24))"
        $dbSalt = python -c "import secrets; print(secrets.token_urlsafe(24))"
        $flaskSecret = python -c "import secrets; print(secrets.token_urlsafe(32))"
        $oprfSeed = python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
        $serverKeypair = python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
        $serverPrivate = python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
        $serverPublic = python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
        
        # Replace hardcoded secrets with generated ones
        $envContent = $envContent -replace "MASTER_ENCRYPTION_PASSWORD=.*", "MASTER_ENCRYPTION_PASSWORD=$masterPassword"
        $envContent = $envContent -replace "CYPHER_DB_PASSWORD=.*", "CYPHER_DB_PASSWORD=$dbPassword"
        $envContent = $envContent -replace "CYPHER_DB_SALT=.*", "CYPHER_DB_SALT=$dbSalt"
        $envContent = $envContent -replace "FLASK_SECRET_KEY=.*", "FLASK_SECRET_KEY=$flaskSecret"
        $envContent = $envContent -replace "OPRF_SEED=.*", "OPRF_SEED=$oprfSeed"
        $envContent = $envContent -replace "SERVER_KEYPAIR_SEED=.*", "SERVER_KEYPAIR_SEED=$serverKeypair"
        $envContent = $envContent -replace "SERVER_PRIVATE_KEY=.*", "SERVER_PRIVATE_KEY=$serverPrivate"
        $envContent = $envContent -replace "SERVER_PUBLIC_KEY=.*", "SERVER_PUBLIC_KEY=$serverPublic"
        
        Set-Content ".env" $envContent
        
        Write-Host "✅ .env file created with generated secrets!" -ForegroundColor Green
        Write-Host "⚠️  Important: Back up your .env file - these secrets are unique and cannot be recovered." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Error: .env.example file not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ".env file already exists" -ForegroundColor Green
}

Write-Host "Starting database services..." -ForegroundColor Yellow
docker compose up -d postgres redis
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start database services" -ForegroundColor Red
    exit 1
}

Write-Host "Waiting for databases to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Initializing database tables..." -ForegroundColor Yellow
python migrations/init_db.py --all
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Database may already be initialized" -ForegroundColor Yellow
}

Write-Host "Creating startup scripts..." -ForegroundColor Yellow

# Create start.ps1
@"
# Cypher startup script for Windows
Write-Host "🚀 Starting Cypher..." -ForegroundColor Green

# Ensure databases are running
Write-Host "Checking database services..." -ForegroundColor Yellow
`$containers = docker compose ps --format json | ConvertFrom-Json
`$postgresRunning = `$containers | Where-Object { `$_.Name -like "*postgres*" -and `$_.State -eq "running" }
if (!`$postgresRunning) {
    Write-Host "Starting database services..." -ForegroundColor Yellow
    docker compose up -d postgres redis
    Start-Sleep -Seconds 5
}

# Find virtual environment
`$venvPaths = @(".\venv", "..\venv", "..\cyvenv", ".\cyvenv")
`$venvPath = ""
foreach (`$path in `$venvPaths) {
    if ((Test-Path `$path) -and (Test-Path "`$path\Scripts\activate.ps1")) {
        `$venvPath = `$path
        break
    }
}

if (`$venvPath -eq "") {
    Write-Host "❌ Error: Virtual environment not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "`$venvPath\Scripts\Activate.ps1"

Write-Host "Starting Flask backend..." -ForegroundColor Yellow
`$flaskJob = Start-Job -ScriptBlock { python main.py }

Write-Host "Starting Node.js API..." -ForegroundColor Yellow
Set-Location node_internal_api
`$nodeJob = Start-Job -ScriptBlock { node app.js }
Set-Location ..

Write-Host ""
Write-Host "🎉 Cypher is running!" -ForegroundColor Green
Write-Host "Flask: http://127.0.0.1:5000" -ForegroundColor Cyan
Write-Host "Node: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Access Cypher: http://localhost:5000" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow

try {
    while (`$true) {
        Start-Sleep -Seconds 1
        if (`$flaskJob.State -eq "Failed" -or `$nodeJob.State -eq "Failed") {
            Write-Host "❌ One of the services failed" -ForegroundColor Red
            break
        }
    }
} finally {
    Write-Host "Stopping services..." -ForegroundColor Yellow
    Stop-Job `$flaskJob, `$nodeJob -ErrorAction SilentlyContinue
    Remove-Job `$flaskJob, `$nodeJob -ErrorAction SilentlyContinue
}
"@ | Set-Content "start.ps1"

# Create dev.ps1
@"
# Cypher development startup script for Windows
Write-Host "🔧 Starting Cypher in Development Mode..." -ForegroundColor Green

# Ensure databases are running
Write-Host "Checking database services..." -ForegroundColor Yellow
`$containers = docker compose ps --format json | ConvertFrom-Json
`$postgresRunning = `$containers | Where-Object { `$_.Name -like "*postgres*" -and `$_.State -eq "running" }
if (!`$postgresRunning) {
    Write-Host "Starting database services..." -ForegroundColor Yellow
    docker compose up -d postgres redis
    Start-Sleep -Seconds 5
}

# Find virtual environment
`$venvPaths = @(".\venv", "..\venv", "..\cyvenv", ".\cyvenv")
`$venvPath = ""
foreach (`$path in `$venvPaths) {
    if ((Test-Path `$path) -and (Test-Path "`$path\Scripts\activate.ps1")) {
        `$venvPath = `$path
        break
    }
}

if (`$venvPath -eq "") {
    Write-Host "❌ Error: Virtual environment not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "`$venvPath\Scripts\Activate.ps1"

Write-Host "Starting Flask backend in debug mode..." -ForegroundColor Yellow
`$env:FLASK_DEBUG = "1"
`$flaskJob = Start-Job -ScriptBlock { python main.py }

Write-Host "Starting Node.js API with nodemon..." -ForegroundColor Yellow
Set-Location node_internal_api
`$nodeJob = Start-Job -ScriptBlock { npx nodemon app.js }
Set-Location ..

Write-Host ""
Write-Host "🎉 Cypher DEV MODE is running!" -ForegroundColor Green
Write-Host "Flask: http://127.0.0.1:5000 (Debug Mode)" -ForegroundColor Cyan
Write-Host "Node: http://localhost:3000 (Hot Reload)" -ForegroundColor Cyan
Write-Host "Access Cypher: http://localhost:5000" -ForegroundColor Green
Write-Host "Hot reload enabled for both services" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow

try {
    while (`$true) {
        Start-Sleep -Seconds 1
        if (`$flaskJob.State -eq "Failed" -or `$nodeJob.State -eq "Failed") {
            Write-Host "❌ One of the services failed" -ForegroundColor Red
            break
        }
    }
} finally {
    Write-Host "Stopping services..." -ForegroundColor Yellow
    Stop-Job `$flaskJob, `$nodeJob -ErrorAction SilentlyContinue
    Remove-Job `$flaskJob, `$nodeJob -ErrorAction SilentlyContinue
}
"@ | Set-Content "dev.ps1"

Write-Host ""
Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Database services:" -ForegroundColor Cyan
Write-Host "  PostgreSQL: localhost:5432" -ForegroundColor White
Write-Host "  Redis: localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "To start Cypher:" -ForegroundColor Cyan
Write-Host "  .\start.ps1     - production mode" -ForegroundColor White
Write-Host "  .\dev.ps1       - development mode with hot reload" -ForegroundColor White
Write-Host ""
Write-Host "To stop databases:" -ForegroundColor Cyan
Write-Host "  docker compose down" -ForegroundColor White
Write-Host ""
Write-Host "🎯 Ready to run Cypher on Windows!" -ForegroundColor Green
