# Generate new secrets for Cypher application (Windows)
# WARNING: This will replace existing secrets and may break existing data!

param(
    [switch]$Force,
    [switch]$Help
)

if ($Help) {
    Write-Host "Cypher Secret Generator for Windows" -ForegroundColor Green
    Write-Host "Usage: .\generate_secrets.ps1 [-Force]" -ForegroundColor Yellow
    Write-Host "  -Force: Skip confirmation prompt" -ForegroundColor Yellow
    Write-Host "WARNING: This will replace existing secrets!" -ForegroundColor Red
    exit 0
}

Write-Host "🔐 Cypher Secret Generator" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  WARNING: This will generate new secrets and may break existing encrypted data!" -ForegroundColor Red
Write-Host "Current secrets will be backed up to .env.backup" -ForegroundColor Yellow
Write-Host ""

if (!$Force) {
    $confirmation = Read-Host "Are you sure you want to continue? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Check if .env exists
if (!(Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}

# Backup existing .env
Write-Host "📋 Backing up current .env to .env.backup..." -ForegroundColor Yellow
Copy-Item ".env" ".env.backup"

# Generate new secrets
Write-Host "🎲 Generating new secrets..." -ForegroundColor Yellow

try {
    $masterPassword = python -c "import secrets; print(secrets.token_urlsafe(32))"
    $dbPassword = python -c "import secrets; print(secrets.token_urlsafe(24))"
    $dbSalt = python -c "import secrets; print(secrets.token_urlsafe(24))"
    $flaskSecret = python -c "import secrets; print(secrets.token_urlsafe(32))"
    $oprfSeed = python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
    $serverKeypair = python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
    $serverPrivate = python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
    $serverPublic = python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
} catch {
    Write-Host "❌ Error generating secrets. Make sure Python is installed." -ForegroundColor Red
    exit 1
}

# Read current .env content
$envContent = Get-Content ".env" -Raw

# Replace secrets in .env file
$envContent = $envContent -replace "MASTER_ENCRYPTION_PASSWORD=.*", "MASTER_ENCRYPTION_PASSWORD=$masterPassword"
$envContent = $envContent -replace "CYPHER_DB_PASSWORD=.*", "CYPHER_DB_PASSWORD=$dbPassword"
$envContent = $envContent -replace "CYPHER_DB_SALT=.*", "CYPHER_DB_SALT=$dbSalt"
$envContent = $envContent -replace "FLASK_SECRET_KEY=.*", "FLASK_SECRET_KEY=$flaskSecret"
$envContent = $envContent -replace "OPRF_SEED=.*", "OPRF_SEED=$oprfSeed"
$envContent = $envContent -replace "SERVER_KEYPAIR_SEED=.*", "SERVER_KEYPAIR_SEED=$serverKeypair"
$envContent = $envContent -replace "SERVER_PRIVATE_KEY=.*", "SERVER_PRIVATE_KEY=$serverPrivate"
$envContent = $envContent -replace "SERVER_PUBLIC_KEY=.*", "SERVER_PUBLIC_KEY=$serverPublic"

# Save updated .env file
Set-Content ".env" $envContent

Write-Host "✅ New secrets generated and saved to .env" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Clear existing database data: .\clear_databases.ps1 (or docker compose down -v)" -ForegroundColor White
Write-Host "2. Re-initialize database: python migrations/init_db.py --all" -ForegroundColor White
Write-Host "3. Restart application: .\start.ps1" -ForegroundColor White
Write-Host ""
Write-Host "🔐 Secret types generated:" -ForegroundColor Yellow
Write-Host "- Master encryption password (32 bytes)" -ForegroundColor White
Write-Host "- Database password (24 bytes)" -ForegroundColor White
Write-Host "- Database salt (24 bytes)" -ForegroundColor White
Write-Host "- Flask secret key (32 bytes)" -ForegroundColor White
Write-Host "- OPRF seed (32 bytes, base64)" -ForegroundColor White
Write-Host "- Server keypair seed (32 bytes, base64)" -ForegroundColor White
Write-Host "- Server private key (32 bytes, base64)" -ForegroundColor White
Write-Host "- Server public key (32 bytes, base64)" -ForegroundColor White
