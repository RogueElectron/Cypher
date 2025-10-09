# Development and Deployment

> **Relevant source files**
> * [.gitignore](https://github.com/RogueElectron/Cypher1/blob/c60431e6/.gitignore)
> * [back-end/setup.sh](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh)
> * [back-end/start.sh](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/start.sh)
> * [back-end/vite.config.js](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/vite.config.js)

## Purpose and Scope

This document provides comprehensive guidance for setting up, building, and running the Cypher authentication platform. It covers prerequisite installation, dependency management, frontend asset compilation, database infrastructure setup, and service orchestration for both development and production environments.

For detailed information about individual services after deployment, see [Backend Services](/RogueElectron/Cypher1/4-backend-services). For database schema and configuration details, see [Data Layer](/RogueElectron/Cypher1/6-data-layer). For frontend module development, see [Frontend Components](/RogueElectron/Cypher1/5-frontend-components).

---

## Development Workflow Overview

The Cypher platform uses an automated setup process that coordinates multiple dependencies, build steps, and service configurations. The workflow follows a three-phase pattern:

**Setup Architecture**

```mermaid
flowchart TD

Python3["python3<br>(3.8+)"]
Node["node<br>(14+)"]
NPM["npm"]
Docker["docker<br>docker compose"]
Check["Command Validation<br>command_exists()"]
VenvCreate["Virtual Environment<br>../cyvenv"]
PipInstall["pip install -r<br>requirements.txt"]
NPMMain["npm install<br>(main)"]
NPMInternal["npm install<br>(node_internal_api)"]
ViteBuild["npx vite build<br>→ static/dist/"]
EnvFile[".env Creation<br>from .env.example"]
DockerUp["docker compose up -d<br>postgres redis"]
InitDB["python migrations/init_db.py<br>--all"]
ScriptGen["Generate start.sh<br>Generate dev.sh"]
DBCheck["Database Health Check<br>docker compose ps"]
ActivateVenv["source ../cyvenv/bin/activate"]
FlaskStart["python main.py<br>:5000"]
NodeStart["node app.js<br>:3000"]
TrapCtrlC["trap INT signal<br>kill PIDs"]
DistDir["static/dist/<br>register.js<br>auth.js<br>session-manager.js<br>index.js"]
Venv["../cyvenv/<br>Python packages"]
NodeMods["node_modules/<br>JS packages"]
DBData["Docker volumes<br>postgres_data<br>redis_data"]

Python3 --> Check
Node --> Check
NPM --> Check
Docker --> Check
ScriptGen --> DBCheck
PipInstall --> Venv
NPMMain --> NodeMods
NPMInternal --> NodeMods
ViteBuild --> DistDir
DockerUp --> DBData

subgraph subGraph3 ["Built Artifacts"]
    DistDir
    Venv
    NodeMods
    DBData
end

subgraph subGraph2 ["Runtime Phase (start.sh/dev.sh)"]
    DBCheck
    ActivateVenv
    FlaskStart
    NodeStart
    TrapCtrlC
    DBCheck --> ActivateVenv
    ActivateVenv --> FlaskStart
    ActivateVenv --> NodeStart
    FlaskStart --> TrapCtrlC
    NodeStart --> TrapCtrlC
end

subgraph subGraph1 ["Setup Phase (setup.sh)"]
    Check
    VenvCreate
    PipInstall
    NPMMain
    NPMInternal
    ViteBuild
    EnvFile
    DockerUp
    InitDB
    ScriptGen
    Check --> VenvCreate
    VenvCreate --> PipInstall
    PipInstall --> NPMMain
    NPMMain --> NPMInternal
    NPMInternal --> ViteBuild
    ViteBuild --> EnvFile
    EnvFile --> DockerUp
    DockerUp --> InitDB
    InitDB --> ScriptGen
end

subgraph Prerequisites ["Prerequisites"]
    Python3
    Node
    NPM
    Docker
end
```

Sources: [back-end/setup.sh L1-L153](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L1-L153)

 [back-end/start.sh L1-L23](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/start.sh#L1-L23)

---

## Prerequisites

The platform requires four core dependencies verified by the `command_exists()` function in the setup script:

| Dependency | Minimum Version | Purpose | Verification Command |
| --- | --- | --- | --- |
| `python3` | 3.8+ | Flask service, database migrations, backend logic | `python3 --version` |
| `node` | 14+ | Node.js internal API, build tooling | `node --version` |
| `npm` | 6+ | Package management for JavaScript dependencies | `npm --version` |
| `docker` | 20+ | PostgreSQL and Redis container orchestration | `docker --version` |

The setup script validates these prerequisites at [back-end/setup.sh L20-L46](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L20-L46)

:

```php
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

if ! command_exists python3; then
    echo -e "${RED}error: python3 required${NC}"
    exit 1
fi
```

**Directory Structure Check**: The script also validates execution from the correct directory by verifying the presence of `main.py` and `package.json` at [back-end/setup.sh L14-L18](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L14-L18)

Sources: [back-end/setup.sh L20-L46](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L20-L46)

---

## Dependency Installation

### Python Environment Setup

The setup process creates a virtual environment in the **parent directory** (`../cyvenv`) to isolate Python dependencies. This design choice keeps the virtual environment outside the project repository.

**Virtual Environment Creation** [back-end/setup.sh L48-L56](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L48-L56)

:

```
if [ ! -d "../cyvenv" ]; then
    echo "creating virtual environment in parent directory..."
    cd .. && python3 -m venv cyvenv && cd back-end
fi

source ../cyvenv/bin/activate
pip install --upgrade pip > /dev/null
pip install -r requirements.txt
```

The `requirements.txt` file contains all Python dependencies including:

* Flask and SQLAlchemy (web framework and ORM)
* `paseto` (token generation)
* PostgreSQL and Redis drivers
* Security libraries

### JavaScript Dependencies

Two separate `npm install` operations occur:

1. **Main Backend Dependencies** [back-end/setup.sh L58-L59](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L58-L59) : * Installed from `back-end/package.json` * Includes Vite build system and frontend libraries * Output: `back-end/node_modules/`
2. **Internal API Dependencies** [back-end/setup.sh L61-L64](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L61-L64) : * Installed from `node_internal_api/package.json` * Includes `@cloudflare/opaque-ts`, `otplib`, `express`, etc. * Output: `node_internal_api/node_modules/`

**Exclusion from Version Control**: The `.gitignore` file excludes all dependency directories:

| Path | Purpose |
| --- | --- |
| `/cyvenv` | Python virtual environment |
| `/back-end/node_modules` | Main JavaScript dependencies |
| `/back-end/node_internal_api/node_modules` | Internal API JavaScript dependencies |
| `/back-end/__pycache__` | Python bytecode cache |
| `/back-end/static/dist/` | Compiled frontend assets |

Sources: [back-end/setup.sh L48-L64](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L48-L64)

 [.gitignore L1-L7](https://github.com/RogueElectron/Cypher1/blob/c60431e6/.gitignore#L1-L7)

---

## Build System

### Vite Configuration

The frontend build system uses Vite with a multi-entry configuration that compiles four JavaScript modules into the `static/dist/` directory.

**Build System Architecture**

```mermaid
flowchart TD

RegisterJS["register.js<br>OPAQUE registration<br>TOTP setup"]
AuthJS["auth.js<br>OPAQUE login<br>TOTP verification"]
SessionMgr["session-manager.js<br>Token lifecycle"]
IndexJS["index.js<br>Main application"]
Config["defineConfig()"]
Plugin["@vitejs/plugin-basic-ssl"]
RollupOpts["rollupOptions"]
InputMap["input:<br>{register, auth,<br>index, session-manager}"]
OutputFmt["output:<br>entryFileNames: '[name].js'"]
Rollup["Rollup Bundler"]
TreeShake["Tree Shaking"]
Minify["Minification"]
RegDist["register.js"]
AuthDist["auth.js"]
SessDist["session-manager.js"]
IdxDist["index.js"]

RegisterJS --> InputMap
AuthJS --> InputMap
SessionMgr --> InputMap
IndexJS --> InputMap
InputMap --> Rollup
OutputFmt --> Rollup
Minify --> RegDist
Minify --> AuthDist
Minify --> SessDist
Minify --> IdxDist

subgraph subGraph3 ["Output (static/dist/)"]
    RegDist
    AuthDist
    SessDist
    IdxDist
end

subgraph subGraph2 ["Build Process"]
    Rollup
    TreeShake
    Minify
    Rollup --> TreeShake
    TreeShake --> Minify
end

subgraph subGraph1 ["Vite Configuration (vite.config.js)"]
    Config
    Plugin
    RollupOpts
    InputMap
    OutputFmt
    Config --> Plugin
    Config --> RollupOpts
    RollupOpts --> InputMap
    RollupOpts --> OutputFmt
end

subgraph subGraph0 ["Source Files (src/)"]
    RegisterJS
    AuthJS
    SessionMgr
    IndexJS
end
```

**Entry Points Configuration** [back-end/vite.config.js L12-L16](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/vite.config.js#L12-L16)

:

The `rollupOptions.input` object maps output filenames to source files:

```yaml
input: {
  register: 'src/register.js',
  auth: 'src/auth.js',
  index: 'src/index.js',
  'session-manager': 'src/session-manager.js'
}
```

**Output Naming Strategy** [back-end/vite.config.js L18-L22](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/vite.config.js#L18-L22)

:

The build produces deterministic filenames without content hashes:

```yaml
output: {
  entryFileNames: '[name].js',
  chunkFileNames: '[name].js',
  assetFileNames: '[name].[ext]'
}
```

This configuration ensures that HTML templates can reliably reference bundled files at fixed paths like `/static/dist/register.js`.

### Build Execution

The setup script triggers the build at [back-end/setup.sh L66-L67](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L66-L67)

:

```
echo "building frontend assets..."
npx vite build > /dev/null
```

**Build Options**:

* `outDir: 'static/dist'` - output directory [back-end/vite.config.js L9](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/vite.config.js#L9-L9)
* `emptyOutDir: true` - clears previous builds [back-end/vite.config.js L10](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/vite.config.js#L10-L10)

### Development Server Configuration

The Vite config includes HTTPS support for the development server via the `@vitejs/plugin-basic-ssl` plugin [back-end/vite.config.js L5-L6](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/vite.config.js#L5-L6)

:

```yaml
plugins: [
  basicSsl()
]
```

**Server Settings** [back-end/vite.config.js L25-L34](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/vite.config.js#L25-L34)

:

| Option | Value | Purpose |
| --- | --- | --- |
| `https` | `true` | Enable HTTPS for local development |
| `proxy['/api'].target` | `http://localhost:5000` | Forward API requests to Flask |
| `proxy['/api'].changeOrigin` | `true` | Modify origin header for CORS |
| `proxy['/api'].secure` | `false` | Allow self-signed certificates |

Sources: [back-end/vite.config.js L1-L36](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/vite.config.js#L1-L36)

 [back-end/setup.sh L66-L67](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L66-L67)

---

## Database Infrastructure

### Docker Compose Orchestration

The platform uses Docker Compose to manage PostgreSQL and Redis containers. The setup script starts these services at [back-end/setup.sh L76-L80](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L76-L80)

:

```
echo "starting database services..."
docker compose up -d postgres redis

echo "waiting for databases to be ready..."
sleep 5
```

**Service Health Check**: Both startup scripts verify database availability before launching application services [back-end/start.sh L4-L9](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/start.sh#L4-L9)

:

```
docker compose ps | grep -q "cypher-postgres.*Up" || {
    echo "starting database services..."
    docker compose up -d postgres redis
    sleep 5
}
```

### Database Initialization

After Docker services start, the setup script initializes database schemas using a migration script [back-end/setup.sh L82-L83](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L82-L83)

:

```php
echo "initializing database tables..."
python migrations/init_db.py --all || echo -e "${YELLOW}database may already be initialized${NC}"
```

The `|| echo` clause handles idempotent re-runs gracefully when tables already exist.

**Connection Details**:

| Service | Host | Port | Access Point |
| --- | --- | --- | --- |
| PostgreSQL | `localhost` | `5432` | Database connections |
| Redis | `localhost` | `6379` | Cache and session storage |

Sources: [back-end/setup.sh L76-L83](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L76-L83)

 [back-end/start.sh L4-L9](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/start.sh#L4-L9)

---

## Service Startup Scripts

The setup script generates two executable shell scripts for different runtime modes.

### Production Mode (start.sh)

**Service Launch Sequence**

```mermaid
sequenceDiagram
  participant start.sh
  participant Docker Compose
  participant Python venv
  participant python main.py
  participant node app.js
  participant User

  start.sh->>Docker Compose: docker compose ps
  loop [Services Not Running]
    start.sh->>Docker Compose: docker compose up -d
    Docker Compose-->>start.sh: postgres redis
    start.sh->>start.sh: Services started
    start.sh->>Python venv: sleep 5
    Python venv-->>start.sh: source ../cyvenv/bin/activate
    start.sh->>python main.py: Environment activated
    python main.py-->>start.sh: python main.py &
    start.sh->>node app.js: FLASK_PID=$!
    node app.js-->>start.sh: Running on :5000
  end
  start.sh->>start.sh: cd node_internal_api
  start.sh->>User: node app.js &
  User->>start.sh: NODE_PID=$!
  start.sh->>python main.py: Running on :3000
  start.sh->>node app.js: trap INT signal
  start.sh->>start.sh: Press Ctrl+C to stop
```

**Script Generation** [back-end/setup.sh L87-L110](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L87-L110)

:

The setup process writes `start.sh` using a heredoc:

```php
cat > start.sh << 'EOF'
#!/bin/bash

# ensure databases are running
echo "checking database services..."
docker compose ps | grep -q "cypher-postgres.*Up" || {
    echo "starting database services..."
    docker compose up -d postgres redis
    sleep 5
}

source ../cyvenv/bin/activate
python main.py &
FLASK_PID=$!
cd node_internal_api
node app.js &
NODE_PID=$!
cd ..
echo "cypher running - flask: http://127.0.0.1:5000 | node: http://localhost:3000"
echo "press ctrl+c to stop"
echo "Access cypher by going to http://localhost:5000"
trap 'kill $FLASK_PID $NODE_PID 2>/dev/null; exit' INT
wait
EOF
```

**Key Features**:

1. **Database Health Check**: Verifies PostgreSQL and Redis are running before service launch
2. **Background Processes**: Both Flask and Node.js run as background jobs (`&`)
3. **PID Tracking**: Captures process IDs (`FLASK_PID`, `NODE_PID`) for cleanup
4. **Graceful Shutdown**: `trap` command kills both services on `Ctrl+C`
5. **Virtual Environment**: Activates `../cyvenv` before running Python

### Development Mode (dev.sh)

The development script includes hot-reload capabilities [back-end/setup.sh L112-L135](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L112-L135)

:

**Differences from Production**:

| Feature | Production (`start.sh`) | Development (`dev.sh`) |
| --- | --- | --- |
| Flask Debug | Standard execution | `FLASK_DEBUG=1 python main.py` |
| Node.js Execution | `node app.js` | `npx nodemon app.js` |
| Auto-Reload | Manual restart required | Automatic on file changes |
| Output | Minimal | Verbose debug logging |

The development script sets the `FLASK_DEBUG=1` environment variable to enable Flask's debugging features and uses `nodemon` to watch for file changes in the Node.js service.

### Script Permissions

The setup script makes both scripts executable [back-end/setup.sh L137](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L137-L137)

:

```
chmod +x start.sh dev.sh
```

Sources: [back-end/setup.sh L87-L137](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L87-L137)

 [back-end/start.sh L1-L23](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/start.sh#L1-L23)

---

## Environment Variables

The setup script creates a `.env` file from a template if one doesn't exist [back-end/setup.sh L70-L74](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L70-L74)

:

```python
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}creating .env file from .env.example${NC}"
    cp .env.example .env
    echo -e "${GREEN}remember to update .env with your settings!${NC}"
fi
```

**Security Note**: The `.env` file is excluded from version control via [.gitignore L5](https://github.com/RogueElectron/Cypher1/blob/c60431e6/.gitignore#L5-L5)

:

```
/back-end/.env
```

This prevents accidental commits of sensitive credentials like database passwords, PASETO encryption keys, and API secrets.

**Expected Variables** (based on system architecture):

| Variable | Purpose | Default/Example |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/cypher` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `PASETO_KEY` | Symmetric key for PASETO tokens | Generated base64 string |
| `REFRESH_KEY` | Key for refresh tokens | Generated base64 string |
| `SESSION_KEY` | Key for intermediate tokens | Generated base64 string |
| `FLASK_SECRET_KEY` | Flask session signing key | Random string |

Sources: [back-end/setup.sh L70-L74](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L70-L74)

 [.gitignore L5](https://github.com/RogueElectron/Cypher1/blob/c60431e6/.gitignore#L5-L5)

---

## Post-Setup Operations

After setup completes, the script displays a summary [back-end/setup.sh L139-L153](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L139-L153)

:

```php
echo ""
echo -e "${GREEN}installation complete!${NC}"
echo ""
echo "database services:"
echo "  PostgreSQL: localhost:5432"
echo "  Redis: localhost:6379"
echo ""
echo "to start cypher:"
echo "  ./start.sh     - production mode"
echo "  ./dev.sh       - development mode with hot reload"
echo ""
echo "to stop databases:"
echo "  docker compose down"
echo ""
```

### Common Operations

**Starting the Platform**:

```markdown
./start.sh          # Production mode
./dev.sh            # Development mode with hot reload
```

**Stopping Services**:

```markdown
# Ctrl+C stops Flask and Node.js (via trap)
# Databases keep running

docker compose down  # Stop databases
```

**Rebuilding Frontend Assets**:

```
npx vite build
```

**Database Management**:

```sql
docker compose up -d postgres redis    # Start databases
docker compose down                    # Stop and remove containers
docker compose down -v                 # Stop and delete volumes (data loss!)
```

**Accessing Services**:

| Service | URL | Purpose |
| --- | --- | --- |
| Flask Web Interface | `http://localhost:5000` | Main application entry point |
| Node.js Internal API | `http://localhost:3000` | OPAQUE and TOTP endpoints (internal) |
| PostgreSQL | `localhost:5432` | Database connections |
| Redis | `localhost:6379` | Cache connections |

Sources: [back-end/setup.sh L139-L153](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L139-L153)

 [back-end/start.sh L18-L20](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/start.sh#L18-L20)

---

## File System Layout

The build and deployment process creates the following directory structure:

```markdown
project-root/
├── cyvenv/                          # Python virtual environment (parent dir)
│   ├── bin/activate                 # Activation script
│   └── lib/python3.x/site-packages/ # Installed packages
│
└── back-end/
    ├── main.py                      # Flask application entry point
    ├── package.json                 # Main JavaScript dependencies
    ├── requirements.txt             # Python dependencies
    ├── vite.config.js               # Frontend build configuration
    ├── .env                         # Environment variables (gitignored)
    ├── setup.sh                     # Installation script
    ├── start.sh                     # Production startup (generated)
    ├── dev.sh                       # Development startup (generated)
    │
    ├── src/                         # Frontend source files
    │   ├── register.js
    │   ├── auth.js
    │   ├── session-manager.js
    │   └── index.js
    │
    ├── static/dist/                 # Compiled frontend (gitignored)
    │   ├── register.js
    │   ├── auth.js
    │   ├── session-manager.js
    │   └── index.js
    │
    ├── node_modules/                # Main JS dependencies (gitignored)
    │
    ├── node_internal_api/
    │   ├── app.js                   # Node.js API entry point
    │   ├── package.json             # Internal API dependencies
    │   └── node_modules/            # Internal API JS deps (gitignored)
    │
    └── migrations/
        └── init_db.py               # Database schema initialization
```

**Gitignored Paths** [.gitignore L1-L7](https://github.com/RogueElectron/Cypher1/blob/c60431e6/.gitignore#L1-L7)

:

* `/cyvenv` - Virtual environment
* `/back-end/node_modules` - Main dependencies
* `/back-end/node_internal_api/node_modules` - Internal API dependencies
* `/back-end/__pycache__` - Python bytecode
* `/back-end/src/__pycache__` - Nested Python cache
* `/back-end/.env` - Environment secrets
* `/back-end/static/dist/` - Build artifacts

Sources: [.gitignore L1-L7](https://github.com/RogueElectron/Cypher1/blob/c60431e6/.gitignore#L1-L7)

 [back-end/setup.sh L1-L153](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L1-L153)

---

## Troubleshooting

### Common Setup Issues

**Issue**: "error: python3 required"

* **Cause**: Python 3 not installed or not in PATH
* **Solution**: Install Python 3.8+ and ensure `python3` command is available

**Issue**: "error: run this script from the back-end directory"

* **Cause**: Executing `setup.sh` from wrong directory
* **Solution**: Navigate to `back-end/` before running `./setup.sh`

**Issue**: Database connection errors during startup

* **Cause**: Docker services not running or not healthy
* **Solution**: Manually verify with `docker compose ps`, wait longer, or check logs with `docker compose logs postgres`

**Issue**: Port already in use (5000 or 3000)

* **Cause**: Previous services not properly terminated
* **Solution**: Kill existing processes or change ports in configuration

### Verification Steps

**After Setup**:

1. Check virtual environment exists: `ls ../cyvenv/bin/activate`
2. Verify Docker containers: `docker compose ps` (should show `Up` status)
3. Check built assets: `ls static/dist/` (should contain 4 `.js` files)
4. Confirm executable permissions: `ls -l start.sh dev.sh` (should show `x` permission)

**After Startup**:

1. Test Flask endpoint: `curl http://localhost:5000/api/health` (if health endpoint exists)
2. Test Node.js API: `curl http://localhost:3000/health` (if health endpoint exists)
3. Verify PostgreSQL: `docker compose exec postgres psql -U cypher -c "SELECT 1;"`
4. Verify Redis: `docker compose exec redis redis-cli PING` (should return `PONG`)

Sources: [back-end/setup.sh L14-L46](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/setup.sh#L14-L46)

 [back-end/start.sh L4-L9](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/start.sh#L4-L9)