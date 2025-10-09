# Installation and Setup

> **Relevant source files**
> * [.gitignore](https://github.com/RogueElectron/Cypher1/blob/c60431e6/.gitignore)
> * [back-end/libsodium.dll](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/libsodium.dll)
> * [back-end/setup.sh](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh)
> * [back-end/start.sh](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/start.sh)

## Purpose and Scope

This document provides step-by-step instructions for installing and configuring the Cypher authentication platform on a development or production machine. It covers prerequisite software, dependency installation, database initialization, and environment configuration.

For information about building frontend assets, see [Build System](/RogueElectron/Cypher1/7.2-build-system). For information about running the application after installation, see [Running the Application](/RogueElectron/Cypher1/7.3-running-the-application).

---

## Prerequisites

The Cypher platform requires the following software to be installed on the host system:

| Software | Minimum Version | Purpose |
| --- | --- | --- |
| **Python 3** | 3.8+ | Flask session service backend |
| **Node.js** | 14+ | Node.js internal API and build tools |
| **npm** | 6+ | Node.js package management |
| **Docker** | 20+ | PostgreSQL and Redis containerization |
| **Docker Compose** | 1.27+ | Multi-container orchestration |

The `setup.sh` script validates these prerequisites before proceeding with installation [setup.sh L20-L46](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L20-L46)

**Sources:** [setup.sh L20-L46](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L20-L46)

---

## Installation Workflow

### Overview

The installation process consists of six sequential phases executed by the `setup.sh` script:

**Installation Workflow Diagram**

```mermaid
flowchart TD

Start["Start setup.sh"]
CheckPrereq["Check Prerequisites<br>python3, node, npm, docker"]
Error["Exit with error"]
CreateVenv["Create Python Virtual Environment<br>../cyvenv/"]
InstallPy["Install Python Dependencies<br>pip install -r requirements.txt"]
InstallMainNpm["Install Main Backend Dependencies<br>npm install (root)"]
InstallApiNpm["Install Internal API Dependencies<br>npm install (node_internal_api/)"]
BuildVite["Build Frontend Assets<br>npx vite build"]
CreateEnv["Create .env from .env.example<br>(if not exists)"]
StartDocker["Start Database Services<br>docker compose up -d postgres redis"]
Wait["Wait 5 seconds for DB ready"]
InitDB["Initialize Database Schema<br>python migrations/init_db.py --all"]
GenScripts["Generate Startup Scripts<br>start.sh, dev.sh"]
Complete["Installation Complete"]

Start --> CheckPrereq
CheckPrereq --> Error
CheckPrereq --> CreateVenv
CreateVenv --> InstallPy
InstallPy --> InstallMainNpm
InstallMainNpm --> InstallApiNpm
InstallApiNpm --> BuildVite
BuildVite --> CreateEnv
CreateEnv --> StartDocker
StartDocker --> Wait
Wait --> InitDB
InitDB --> GenScripts
GenScripts --> Complete
```

**Sources:** [setup.sh L1-L153](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L1-L153)

---

### Directory Structure

After successful installation, the following directory structure is created:

**Post-Installation Directory Structure**

```mermaid
flowchart TD

Root["Project Root"]
Cyvenv["../cyvenv/<br>(Python virtual environment)"]
Backend["back-end/"]
NodeMods["node_modules/<br>(main backend dependencies)"]
StaticDist["static/dist/<br>(compiled frontend assets)"]
NodeAPI["node_internal_api/"]
EnvFile[".env<br>(configuration file)"]
StartScript["start.sh<br>(production startup)"]
DevScript["dev.sh<br>(development startup)"]
ApiNodeMods["node_modules/<br>(API dependencies)"]
PyCache["pycache/<br>(Python bytecode)"]
SrcCache["src/pycache/"]

Root --> Cyvenv
Root --> Backend
Backend --> NodeMods
Backend --> StaticDist
Backend --> NodeAPI
Backend --> EnvFile
Backend --> StartScript
Backend --> DevScript
NodeAPI --> ApiNodeMods
Backend --> PyCache
Backend --> SrcCache
```

Files and directories marked in `.gitignore` are generated during installation and excluded from version control [.gitignore L1-L7](https://github.com/RogueElectron/Cypher1/blob/c60431e6/.gitignore#L1-L7)

**Sources:** [.gitignore L1-L7](https://github.com/RogueElectron/Cypher1/blob/c60431e6/.gitignore#L1-L7)

 [setup.sh L49-L67](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L49-L67)

---

## Step-by-Step Installation

### Step 1: Navigate to Installation Directory

Execute the setup script from the `back-end` directory:

```
cd back-end
./setup.sh
```

The script validates the current directory by checking for the presence of `main.py` and `package.json` [setup.sh L14-L18](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L14-L18)

**Sources:** [setup.sh L14-L18](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L14-L18)

---

### Step 2: Python Environment Setup

The script creates a Python virtual environment in `../cyvenv` (parent directory) if it doesn't already exist [setup.sh L48-L52](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L48-L52)

 This isolates Python dependencies from the system installation.

```markdown
# Executed by setup.sh
python3 -m venv ../cyvenv
source ../cyvenv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

**Python Dependencies Installed:**

* `flask` - Web framework
* `sqlalchemy` - ORM for PostgreSQL
* `redis` - Redis client
* `pyseto` - PASETO token library
* `flask-cors` - Cross-origin resource sharing
* Additional security and utility packages

**Sources:** [setup.sh L48-L56](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L48-L56)

---

### Step 3: Node.js Dependencies Installation

Node.js dependencies are installed for two separate services:

**Main Backend (`back-end/`):**

```
npm install
```

Installs Vite build system and frontend dependencies.

**Internal API (`back-end/node_internal_api/`):**

```
cd node_internal_api
npm install
cd ..
```

Installs OPAQUE protocol libraries (`@cloudflare/opaque-ts`), TOTP libraries (`otplib`), and Node.js server dependencies.

**Sources:** [setup.sh L58-L64](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L58-L64)

---

### Step 4: Frontend Asset Compilation

The Vite build system compiles client-side JavaScript modules into `static/dist/`:

```
npx vite build
```

This generates four bundled JavaScript files:

* `register.js` - Registration workflow
* `auth.js` - Login workflow
* `session-manager.js` - Token lifecycle management
* `index.js` - Main application UI

For detailed build configuration, see [Build System](/RogueElectron/Cypher1/7.2-build-system).

**Sources:** [setup.sh L66-L67](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L66-L67)

---

### Step 5: Environment Configuration

If `.env` does not exist, the script creates it from `.env.example` [setup.sh L70-L74](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L70-L74)

:

```
cp .env.example .env
```

**Critical Environment Variables:**

| Variable | Purpose | Example Value |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/cypher` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `SESSION_KEY` | PASETO v4 session token key | (32-byte hex string) |
| `REFRESH_KEY` | PASETO v4 refresh token key | (32-byte hex string) |
| `INTERMEDIATE_KEY` | PASETO v4 intermediate token key | (32-byte hex string) |
| `FLASK_SECRET_KEY` | Flask session secret | (random string) |

**Security Note:** Update `.env` with production-grade secrets before deployment. The default `.env.example` contains placeholder values suitable only for development.

**Sources:** [setup.sh L70-L74](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L70-L74)

---

### Step 6: Database Infrastructure Setup

**Docker Compose Services:**

The script starts two containerized database services [setup.sh L76-L80](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L76-L80)

:

```markdown
docker compose up -d postgres redis
sleep 5  # Wait for services to initialize
```

**Service Configuration:**

| Service | Container Name | Port | Purpose |
| --- | --- | --- | --- |
| PostgreSQL | `cypher-postgres` | 5432 | Persistent data storage |
| Redis | `cypher-redis` | 6379 | Session cache and rate limiting |

**Database Schema Initialization:**

After services start, the script initializes database tables [setup.sh L82-L83](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L82-L83)

:

```
python migrations/init_db.py --all
```

This creates the following tables:

* `users` - User accounts with OPAQUE records and TOTP secrets
* `UserSession` - Active session tracking
* `RefreshToken` - Refresh token audit trail
* `AuditLog` - Security event logging

For detailed schema documentation, see [PostgreSQL Schema](/RogueElectron/Cypher1/6.1-postgresql-schema).

**Sources:** [setup.sh L76-L83](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L76-L83)

---

### Step 7: Startup Script Generation

The setup script generates two executable shell scripts in the `back-end/` directory:

**`start.sh` - Production Mode**

Launches both Flask and Node.js services in production configuration [setup.sh L87-L110](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L87-L110)

:

```bash
#!/bin/bash
# Ensure databases are running
docker compose ps | grep -q "cypher-postgres.*Up" || {
    docker compose up -d postgres redis
    sleep 5
}

source ../cyvenv/bin/activate
python main.py &
FLASK_PID=$!
cd node_internal_api
node app.js &
NODE_PID=$!
```

**`dev.sh` - Development Mode**

Launches services with debug mode and hot reload [setup.sh L112-L135](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L112-L135)

:

```
source ../cyvenv/bin/activate
FLASK_DEBUG=1 python main.py &
FLASK_PID=$!
cd node_internal_api
npx nodemon app.js &
NODE_PID=$!
```

**Differences:**

* `FLASK_DEBUG=1` enables Flask debugging and auto-reload
* `nodemon` provides automatic Node.js restart on file changes

Both scripts register signal handlers to gracefully terminate both processes on `Ctrl+C`.

For usage instructions, see [Running the Application](/RogueElectron/Cypher1/7.3-running-the-application).

**Sources:** [setup.sh L85-L137](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L85-L137)

 [start.sh L1-L23](https://github.com/RogueElectron/Cypher1/blob/c60431e6/start.sh#L1-L23)

---

## Verification

### Post-Installation Checklist

After `setup.sh` completes successfully, verify the following:

**File System Verification:**

| Path | Expected State |
| --- | --- |
| `../cyvenv/` | Virtual environment directory exists |
| `node_modules/` | Main backend dependencies installed |
| `node_internal_api/node_modules/` | API dependencies installed |
| `static/dist/register.js` | Compiled frontend asset exists |
| `static/dist/auth.js` | Compiled frontend asset exists |
| `static/dist/session-manager.js` | Compiled frontend asset exists |
| `static/dist/index.js` | Compiled frontend asset exists |
| `.env` | Configuration file exists |
| `start.sh` | Executable startup script exists |
| `dev.sh` | Executable development script exists |

**Service Verification:**

```markdown
# Check Docker services
docker compose ps

# Expected output:
# NAME               STATUS
# cypher-postgres    Up
# cypher-redis       Up
```

**Database Connection Test:**

```sql
# Test PostgreSQL connection
docker exec cypher-postgres psql -U cypher -c "SELECT 1;"

# Test Redis connection
docker exec cypher-redis redis-cli ping
# Expected: PONG
```

**Sources:** [setup.sh L139-L152](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L139-L152)

---

## Installation Process Summary

**Complete Setup Sequence Diagram**

```mermaid
sequenceDiagram
  participant Administrator
  participant setup.sh
  participant Host System
  participant Docker Compose
  participant PostgreSQL
  participant Redis Cache

  Administrator->>setup.sh: ./setup.sh
  setup.sh->>Host System: Check python3, node, npm, docker
  Host System-->>setup.sh: All prerequisites found
  setup.sh->>Host System: python3 -m venv ../cyvenv
  setup.sh->>Host System: pip install -r requirements.txt
  setup.sh->>Host System: npm install (root)
  setup.sh->>Host System: npm install (node_internal_api/)
  setup.sh->>Host System: npx vite build
  Host System-->>setup.sh: static/dist/*.js created
  setup.sh->>Host System: cp .env.example .env (if needed)
  setup.sh->>Docker Compose: docker compose up -d postgres redis
  Docker Compose->>PostgreSQL: Start container on port 5432
  Docker Compose->>Redis Cache: Start container on port 6379
  Docker Compose-->>setup.sh: Services running
  setup.sh->>Host System: python migrations/init_db.py --all
  Host System->>PostgreSQL: CREATE TABLE users, UserSession, RefreshToken, AuditLog
  PostgreSQL-->>Host System: Schema initialized
  setup.sh->>Host System: Generate start.sh and dev.sh
  setup.sh-->>Administrator: Installation complete!
  note over Administrator,Redis Cache: System ready for startup
```

**Sources:** [setup.sh L1-L153](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L1-L153)

---

## Troubleshooting Common Issues

### Issue: "Error: run this script from the back-end directory"

**Cause:** Script executed from incorrect directory [setup.sh L14-L18](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L14-L18)

**Solution:**

```
cd back-end
./setup.sh
```

---

### Issue: "Error: docker required for database services"

**Cause:** Docker not installed or not in system PATH [setup.sh L43-L46](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L43-L46)

**Solution:**

* Install Docker: [https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/)
* Verify installation: `docker --version`

---

### Issue: Database initialization fails

**Cause:** PostgreSQL service not ready within 5-second timeout [setup.sh L79-L80](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L79-L80)

**Solution:**

```markdown
# Wait for PostgreSQL to be fully ready
docker exec cypher-postgres pg_isready -U cypher

# Manually run initialization
source ../cyvenv/bin/activate
python migrations/init_db.py --all
```

---

### Issue: Port conflicts (5432, 6379, 5000, 3000)

**Cause:** Services already running on required ports.

**Solution:**

```markdown
# Check port usage
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :5000  # Flask
lsof -i :3000  # Node.js API

# Modify docker-compose.yml to use different ports
# Or stop conflicting services
```

---

## Next Steps

After successful installation:

1. **Review Configuration:** Edit `.env` with production-appropriate secrets and database credentials
2. **Start Services:** See [Running the Application](/RogueElectron/Cypher1/7.3-running-the-application) for instructions on launching Flask and Node.js services
3. **Access Application:** Navigate to `http://localhost:5000` after starting services
4. **Development Setup:** If developing the platform, see [Build System](/RogueElectron/Cypher1/7.2-build-system) for Vite configuration details

**Default Service Endpoints:**

| Service | URL | Purpose |
| --- | --- | --- |
| Flask Web Interface | `http://localhost:5000` | Main application, login/register pages |
| Flask API | `http://localhost:5000/api/*` | Token management endpoints |
| Node.js Internal API | `http://localhost:3000` | OPAQUE and TOTP endpoints (internal only) |
| PostgreSQL | `localhost:5432` | Database access |
| Redis | `localhost:6379` | Cache access |

**Sources:** [setup.sh L142-L152](https://github.com/RogueElectron/Cypher1/blob/c60431e6/setup.sh#L142-L152)

 [start.sh L18-L20](https://github.com/RogueElectron/Cypher1/blob/c60431e6/start.sh#L18-L20)