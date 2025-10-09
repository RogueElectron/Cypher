# Cypher - Windows Setup Guide

Welcome to Cypher on Windows! This guide will help you get up and running quickly.

## Quick Start

### Prerequisites
- Python 3.8+ - [Download from python.org](https://python.org)
- Node.js 16+ - [Download from nodejs.org](https://nodejs.org)
- Docker Desktop - [Download from docker.com](https://docker.com/products/docker-desktop)

### Installation Options

#### Option 1: PowerShell (Recommended)
```powershell
# Navigate to back-end directory
cd back-end

# Run setup script
.\setup.ps1
```

#### Option 2: Command Prompt/Batch
```cmd
# Navigate to back-end directory
cd back-end

# Run setup script
setup.bat
```

## Running Cypher

### PowerShell (Recommended)
```powershell
# Production mode
.\start.ps1

# Development mode (with hot reload)
.\dev.ps1
```

### Batch Files
```cmd
# Production mode
start.bat
```

## Security Setup

Important: The default setup uses development secrets that are NOT secure for production.

### Generate Secure Secrets
```powershell
# Generate new random secrets
.\generate_secrets.ps1

# Or force without confirmation
.\generate_secrets.ps1 -Force
```

Warning: Generating new secrets will invalidate existing encrypted data!

## Troubleshooting

### PowerShell Execution Policy
If you get an execution policy error:
```powershell
# Temporarily allow script execution
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# Then run the script
.\setup.ps1
```

### Docker Issues
- Make sure Docker Desktop is running
- Check that containers are healthy: `docker compose ps`
- Restart services: `docker compose restart`

### Virtual Environment Issues
The scripts automatically detect virtual environments in these locations:
- `.\venv` (current directory)
- `..\venv` (parent directory)
- `..\cyvenv` (legacy location)
- `.\cyvenv` (current directory, legacy name)

### Database Connection Issues
1. Check if PostgreSQL is running: `docker compose ps`
2. Verify environment variables in `.env` file
3. Restart database: `docker compose restart postgres`

## File Structure

```
back-end/
├── setup.ps1           # powershell setup script
├── setup.bat           # batch setup script
├── start.ps1           # powershell start script
├── dev.ps1            # powershell development script
├── start.bat          # batch start script
├── generate_secrets.ps1 # secret generation script
├── clear_databases.ps1  # wipe all database data (powershell)
├── clear_databases.bat  # wipe all database data (batch)
├── reset_databases.ps1  # reset and reinitialize databases
├── .env.example       # environment template
├── .env               # your environment (created during setup)
└── ...
```

## Access Points

After starting Cypher:
- Main Application: http://localhost:5000
- Flask Backend: http://127.0.0.1:5000
- Node.js API: http://localhost:3000

## Development

### Hot Reload Development
```powershell
# Start in development mode
.\dev.ps1
```

This enables:
- Flask debug mode with auto-restart
- Nodemon for Node.js hot reload
- Detailed error logging

### Database Management
```powershell
# wipe all database data (careful!)
.\clear_databases.ps1

# reset and reinitialize everything
.\reset_databases.ps1

# stop databases
docker compose down

# stop and remove data (nuclear option)
docker compose down -v

# view logs
docker compose logs postgres
docker compose logs redis
```

## Getting Help

### Common Commands
```powershell
# View help for setup script
.\setup.ps1 -Help

# View help for secret generator
.\generate_secrets.ps1 -Help

# Check Python version
python --version

# Check Node.js version
node --version

# Check Docker version
docker --version
```

### Support
- Check the main README.md for general documentation
- Review logs in Docker Desktop
- Verify .env file configuration
- Ensure all prerequisites are installed

## Updates

When updating Cypher:
1. Pull latest changes: `git pull`
2. Update dependencies: `.\setup.ps1` (it will skip existing setup)
3. Restart services: `.\start.ps1`

---

