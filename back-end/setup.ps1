# Cypher installation script for Windows
# Run this in the back-end directory
# Requires: Python 3, Node.js, npm

# Colors
$Red = "`e[31m"
$Green = "`e[32m"
$NC = "`e[0m"

# Check current directory
if (!(Test-Path "main.py") -or !(Test-Path "package.json")) {
    Write-Host "${Red}Error: Run this script from the back-end directory${NC}"
    exit 1
}

# Check prerequisites
Write-Host "Checking prerequisites..."
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "${Red}Error: Python3 required${NC}"
    exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "${Red}Error: Node.js required${NC}"
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "${Red}Error: npm required${NC}"
    exit 1
}

# Setup Python environment
Write-Host "Setting up Python environment..."
if (-not (Test-Path "venv")) {
    python -m venv venv
}

# Activate venv
& .\venv\Scripts\Activate.ps1

# Upgrade pip and install requirements
python -m pip install --upgrade pip
pip install -r requirements.txt

# Install main backend dependencies
Write-Host "Installing main backend dependencies..."
npm install

# Install internal API dependencies
Write-Host "Installing internal API dependencies..."
Set-Location node_internal_api
npm install
Set-Location ..

# Build frontend assets
Write-Host "Building frontend assets..."
npx vite build

# Create startup scripts
$startScript = @"
# Start Cypher (Windows)
.\venv\Scripts\Activate.ps1
Start-Process python main.py
Start-Process node node_internal_api\app.js
Write-Host "Cypher running - Flask: http://127.0.0.1:5000 | Node: http://localhost:3000"
Write-Host "Press Ctrl+C to stop"
"@
$startScript | Out-File -Encoding UTF8 start.ps1

Write-Host "${Green}Installation complete!${NC}"
Write-Host "Run: .\start.ps1"
