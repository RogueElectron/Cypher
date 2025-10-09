# Component Overview

> **Relevant source files**
> * [back-end/main.py](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py)
> * [back-end/node_internal_api/app.js](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js)
> * [back-end/node_internal_api/db.js](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/db.js)
> * [back-end/node_internal_api/package-lock.json](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/package-lock.json)
> * [back-end/node_internal_api/package.json](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/package.json)
> * [back-end/package-lock.json](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/package-lock.json)
> * [back-end/package.json](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/package.json)

## Purpose and Scope

This document provides a detailed inventory of the major system components that comprise the Cypher authentication platform. Each component is mapped to its corresponding code entities, dependencies, and technical implementation. For information about how these components communicate and exchange data, see [Data Flow and Communication Patterns](/RogueElectron/Cypher1/2.2-data-flow-and-communication-patterns). For detailed API endpoint specifications, see [API Reference](/RogueElectron/Cypher1/4.3-api-reference).

---

## System Components Map

The Cypher platform consists of five primary component categories: backend services, client-side modules, data stores, build tooling, and orchestration infrastructure.

```mermaid
flowchart TD

Flask["Flask Application<br>main.py<br>Port 5000"]
NodeAPI["Node.js Internal API<br>app.js<br>Port 3000"]
NodeDB["PostgreSQL Storage Layer<br>db.js"]
Register["register.js<br>OPAQUE + TOTP Setup"]
Auth["auth.js<br>OPAQUE Login + TOTP Verify"]
SessionMgr["session-manager.js<br>Token Lifecycle"]
IndexApp["index.js<br>Main Application"]
PG["PostgreSQL Database<br>cypher_db<br>Tables: users, UserSession,<br>RefreshToken, AuditLog"]
RedisCache["Redis<br>Session Cache<br>Token Blacklist<br>Rate Limiting"]
Vite["Vite Build<br>vite.config.js<br>4 Entry Points"]
Docker["Docker Compose<br>postgres + redis"]
Setup["setup.sh / setup.ps1<br>Orchestration Scripts"]

Flask --> PG
Flask --> RedisCache
NodeAPI --> PG
NodeDB --> PG
Register --> NodeAPI
Auth --> NodeAPI
Auth --> Flask
SessionMgr --> Flask
Vite --> Register
Vite --> Auth
Vite --> SessionMgr
Vite --> IndexApp
Docker --> PG
Docker --> RedisCache

subgraph subGraph3 ["Build System"]
    Vite
    Docker
    Setup
    Setup --> Docker
    Setup --> Vite
end

subgraph subGraph2 ["Data Stores"]
    PG
    RedisCache
end

subgraph subGraph1 ["Client Components"]
    Register
    Auth
    SessionMgr
    IndexApp
end

subgraph subGraph0 ["Backend Services"]
    Flask
    NodeAPI
    NodeDB
    NodeAPI --> Flask
end
```

**Sources:** [back-end/main.py L1-L564](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L1-L564)

 [back-end/node_internal_api/app.js L1-L502](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L1-L502)

 [back-end/node_internal_api/db.js L1-L151](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/db.js#L1-L151)

---

## Flask Session Service

The Flask application serves as the **token authority** and **session manager** for the platform, running on port 5000. It is implemented in a single Python module with modular imports for database and Redis management.

### Core Responsibilities

| Responsibility | Implementation Location |
| --- | --- |
| PASETO Token Creation | [main.py L92-L112](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L92-L112) <br>  `create_token()` |
| PASETO Token Verification | [main.py L114-L149](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L114-L149) <br>  `verify_token()` |
| Session Creation | [main.py L150-L305](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L150-L305) <br>  `create_session()` |
| Access Token Verification | [main.py L307-L386](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L307-L386) <br>  `verify_access()` |
| Token Refresh | [main.py L388-L513](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L388-L513) <br>  `refresh_token()` |
| Logout/Cleanup | [main.py L515-L561](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L515-L561) <br>  `logout()` |
| Template Serving | [main.py L76-L91](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L76-L91) <br>  Route handlers |

### Technology Stack

```mermaid
flowchart TD

FlaskApp["Flask Application<br>main.py"]
PasetoLib["paseto<br>ProtocolVersion4"]
SQLAlchemy["SQLAlchemy ORM<br>src/database_config.py"]
RedisManagers["Redis Managers<br>src/redis_manager.py"]
Models["Data Models<br>src/models.py"]
Encryption["Encryption Manager<br>src/encryption_manager.py"]
SymmetricKey["3 Symmetric Keys<br>key, session_key, refresh_key"]
SessionMgr["SessionManager"]
TokenMgr["TokenManager"]
RateLimiter["RateLimiter"]
User["User"]
UserSession["UserSession"]
RefreshToken["RefreshToken"]
AuditLog["AuditLog"]

FlaskApp --> PasetoLib
FlaskApp --> SQLAlchemy
FlaskApp --> RedisManagers
FlaskApp --> Models
FlaskApp --> Encryption
PasetoLib --> SymmetricKey
RedisManagers --> SessionMgr
RedisManagers --> TokenMgr
RedisManagers --> RateLimiter
Models --> User
Models --> UserSession
Models --> RefreshToken
Models --> AuditLog
```

### Key Configuration

The Flask service uses three distinct PASETO symmetric keys:

* **`key`**: Intermediate authentication token (3-minute lifetime) - [main.py L32](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L32-L32)
* **`session_key`**: Access token (15-minute lifetime) - [main.py L33](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L33-L33)
* **`refresh_key`**: Refresh token (7-day lifetime) - [main.py L34](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L34-L34)

The service initializes on startup via `initialize_app()` [main.py L39-L69](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L39-L69)

 which:

1. Initializes encryption manager
2. Connects to PostgreSQL and Redis
3. Creates database tables via SQLAlchemy
4. Verifies all subsystems are operational

**Sources:** [back-end/main.py L1-L564](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L1-L564)

 [back-end/package.json L1-L17](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/package.json#L1-L17)

---

## Node.js Internal API

The Node.js service implements **cryptographic operations** (OPAQUE and TOTP) and acts as the **authentication gateway**, running on port 3000. It is the only component that handles password-related cryptography.

### Core Modules

```mermaid
flowchart TD

AppJS["app.js<br>Main Application<br>Express Server"]
DbJS["db.js<br>PostgreSQL Storage Layer<br>createPostgresStorage()"]
OpaqueServer["OpaqueServer<br>@cloudflare/opaque-ts"]
TOTP["authenticator<br>otplib"]
QRCode["QRCode<br>qrcode library"]
Config["OpaqueConfig<br>OpaqueID.OPAQUE_P256"]
Keys["Server Keypair<br>serverAkeKeypair"]
Pool["pg.Pool<br>PostgreSQL Connection"]

AppJS --> OpaqueServer
AppJS --> TOTP
AppJS --> QRCode
AppJS --> DbJS
OpaqueServer --> Config
OpaqueServer --> Keys
DbJS --> Pool
```

### API Endpoints by Category

| Category | Endpoints | Implementation |
| --- | --- | --- |
| **OPAQUE Registration** | `POST /register/init``POST /register/finish` | [app.js L143-L220](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L143-L220) |
| **OPAQUE Login** | `POST /login/init``POST /login/finish` | [app.js L222-L325](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L222-L325) |
| **TOTP Management** | `POST /totp/setup``POST /totp/verify-setup``POST /totp/verify-login` | [app.js L329-L496](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L329-L496) |

### OPAQUE Configuration

The server initializes OPAQUE with P-256 elliptic curve cryptography:

```javascript
// Line 82-87 in app.js
const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);
const oprfSeed = cfg.prng.random(cfg.hash.Nh);
const serverKeypairSeed = cfg.prng.random(cfg.constants.Nseed);
const serverAkeKeypair = await cfg.ake.deriveAuthKeyPair(serverKeypairSeed);
```

The `OpaqueServer` instance [app.js L133-L137](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L133-L137)

 is shared across all authentication requests and maintains cryptographic state.

### State Management

The Node.js API maintains three in-memory state stores:

| Store | Type | Purpose | Cleanup |
| --- | --- | --- | --- |
| `totpSecrets` | `Map<username, secret>` | Temporary TOTP secrets during setup | Cleared after verification [app.js L124](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L124-L124) |
| `unverifiedAccounts` | `Map<username, timeoutId>` | Pending account verification | 5-minute timeout [app.js L92](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L92-L92) |
| `global.userSessions` | `Map<username, expected>` | OPAQUE authentication state | Cleared after login [app.js L278](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L278-L278) |

**Sources:** [back-end/node_internal_api/app.js L1-L502](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L1-L502)

 [back-end/node_internal_api/package.json L1-L31](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/package.json#L1-L31)

---

## PostgreSQL Storage Layer

The Node.js API interacts with PostgreSQL through a dedicated storage module that abstracts database operations.

### Storage Interface

The `createPostgresStorage()` function [db.js L30-L148](https://github.com/RogueElectron/Cypher1/blob/c60431e6/db.js#L30-L148)

 returns an object implementing the following methods:

```mermaid
flowchart TD

Storage["createPostgresStorage()<br>db.js"]
Store["store(username, opaqueRecord)<br>Lines 32-63"]
Lookup["lookup(username)<br>Lines 65-86"]
Delete["delete(username)<br>Lines 88-97"]
StoreTOTP["storeTotpSecret(username, secret)<br>Lines 99-109"]
GetTOTP["getTotpSecret(username)<br>Lines 111-125"]
EnableTOTP["enableTotp(username)<br>Lines 127-136"]
Clear["clear()<br>Lines 138-146"]
Base64["Base64 Encoding<br>Buffer.from().toString('base64')"]
Uint8Array["Uint8Array Conversion<br>new Uint8Array(Buffer.from())"]

Storage --> Store
Storage --> Lookup
Storage --> Delete
Storage --> StoreTOTP
Storage --> GetTOTP
Storage --> EnableTOTP
Storage --> Clear
Store --> Base64
Lookup --> Uint8Array
```

### Connection Pool

The storage layer uses a PostgreSQL connection pool [db.js L10-L19](https://github.com/RogueElectron/Cypher1/blob/c60431e6/db.js#L10-L19)

:

| Configuration | Value | Source |
| --- | --- | --- |
| Host | `process.env.POSTGRES_HOST` or `localhost` | [db.js L11](https://github.com/RogueElectron/Cypher1/blob/c60431e6/db.js#L11-L11) |
| Port | `process.env.POSTGRES_PORT` or `5432` | [db.js L12](https://github.com/RogueElectron/Cypher1/blob/c60431e6/db.js#L12-L12) |
| Database | `process.env.POSTGRES_DB` or `cypher_db` | [db.js L13](https://github.com/RogueElectron/Cypher1/blob/c60431e6/db.js#L13-L13) |
| User | `process.env.POSTGRES_USER` or `cypher_user` | [db.js L14](https://github.com/RogueElectron/Cypher1/blob/c60431e6/db.js#L14-L14) |
| Max Connections | `20` | [db.js L16](https://github.com/RogueElectron/Cypher1/blob/c60431e6/db.js#L16-L16) |
| Idle Timeout | `30000 ms` | [db.js L17](https://github.com/RogueElectron/Cypher1/blob/c60431e6/db.js#L17-L17) |

### OPAQUE Record Storage

OPAQUE records are stored as base64-encoded strings in the `users.opaque_record` column. The conversion happens at storage time [db.js L36](https://github.com/RogueElectron/Cypher1/blob/c60431e6/db.js#L36-L36)

:

```javascript
const opaqueRecordB64 = Buffer.from(opaqueRecord).toString('base64');
```

And reversal at lookup time [db.js L80-L81](https://github.com/RogueElectron/Cypher1/blob/c60431e6/db.js#L80-L81)

:

```javascript
const buffer = Buffer.from(opaqueRecordB64, 'base64');
return new Uint8Array(buffer);
```

**Sources:** [back-end/node_internal_api/db.js L1-L151](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/db.js#L1-L151)

---

## Client-Side Components

The client-side codebase is written in vanilla JavaScript and compiled by Vite into four distinct bundles. These modules are loaded by HTML templates served by Flask.

### Module Structure

```mermaid
flowchart TD

RegisterSrc["register.js<br>OPAQUE Registration<br>TOTP Setup Flow"]
AuthSrc["auth.js<br>OPAQUE Login<br>TOTP Verification"]
SessionSrc["session-manager.js<br>Token Storage<br>Auto-Refresh<br>Multi-Tab Sync"]
IndexSrc["index.js<br>Main Application<br>Session Status"]
RegisterDist["register.js"]
AuthDist["auth.js"]
SessionDist["session-manager.js"]
IndexDist["index.js"]
RegisterHTML["register.html<br>Loads register.js"]
LoginHTML["login.html<br>Loads auth.js"]
IndexHTML["index.html<br>Loads index.js + session-manager.js"]

RegisterSrc --> RegisterDist
AuthSrc --> AuthDist
SessionSrc --> SessionDist
IndexSrc --> IndexDist
RegisterDist --> RegisterHTML
AuthDist --> LoginHTML
SessionDist --> IndexHTML
IndexDist --> IndexHTML

subgraph subGraph2 ["HTML Templates (templates/)"]
    RegisterHTML
    LoginHTML
    IndexHTML
end

subgraph subGraph1 ["Vite Build Output (static/dist/)"]
    RegisterDist
    AuthDist
    SessionDist
    IndexDist
end

subgraph subGraph0 ["Source Files (src/)"]
    RegisterSrc
    AuthSrc
    SessionSrc
    IndexSrc
end
```

### Client Dependencies

Each client module imports the OPAQUE TypeScript library:

| Module | Primary Dependencies | Purpose |
| --- | --- | --- |
| `register.js` | `@cloudflare/opaque-ts` | Client-side OPAQUE registration protocol |
| `auth.js` | `@cloudflare/opaque-ts` | Client-side OPAQUE authentication protocol |
| `session-manager.js` | Native `fetch`, `localStorage`, `BroadcastChannel` | Token lifecycle management |
| `index.js` | `session-manager.js` | Application state coordination |

### Build Configuration

Vite is configured with four entry points in the build configuration:

| Entry Point | Source File | Output Location |
| --- | --- | --- |
| `register` | `src/register.js` | `static/dist/register.js` |
| `auth` | `src/auth.js` | `static/dist/auth.js` |
| `session-manager` | `src/session-manager.js` | `static/dist/session-manager.js` |
| `index` | `src/index.js` | `static/dist/index.js` |

The build system uses the `@vitejs/plugin-basic-ssl` plugin for HTTPS support during development, as referenced in [package.json L12](https://github.com/RogueElectron/Cypher1/blob/c60431e6/package.json#L12-L12)

**Sources:** [back-end/package.json L1-L17](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/package.json#L1-L17)

---

## Data Storage Components

The platform employs a **dual-storage architecture** combining PostgreSQL for durability and Redis for performance.

### PostgreSQL Schema

The PostgreSQL database (`cypher_db`) contains four primary tables managed by SQLAlchemy ORM models:

```mermaid
flowchart TD

Users["users<br>- id (UUID)<br>- username (unique)<br>- opaque_record (base64)<br>- totp_secret (encrypted)<br>- totp_enabled (boolean)<br>- failed_login_attempts (int)<br>- is_active (boolean)<br>- created_at, updated_at"]
Sessions["UserSession<br>- id (UUID)<br>- session_id (unique)<br>- user_id (FK)<br>- ip_address<br>- user_agent<br>- device_fingerprint<br>- expires_at<br>- is_active (boolean)"]
Tokens["RefreshToken<br>- id (UUID)<br>- token_id (unique)<br>- user_id (FK)<br>- session_id (FK)<br>- token_hash<br>- is_active, is_revoked<br>- expires_at<br>- used_at"]
Audit["AuditLog<br>- id (UUID)<br>- event_type<br>- event_category<br>- severity<br>- user_id (FK)<br>- session_id<br>- ip_address<br>- success (boolean)<br>- created_at"]

subgraph subGraph0 ["PostgreSQL Tables"]
    Users
    Sessions
    Tokens
    Audit
    Sessions --> Users
    Tokens --> Users
    Tokens --> Sessions
    Audit --> Users
end
```

### Redis Cache Structure

Redis stores ephemeral session data with TTL-based expiration:

| Cache Type | Key Pattern | TTL | Purpose |
| --- | --- | --- | --- |
| Session Cache | `session:{session_id}` | 3600s (1 hour) | Fast session lookups |
| Token Blacklist | `blacklist:{access_token}` | 900s (15 min) | Revoked access tokens |
| Refresh Token Cache | `refresh:{token_id}` | 604800s (7 days) | Active refresh tokens |
| Rate Limit Counters | `ratelimit:{category}:{identifier}` | 60s | Request throttling |

The Redis managers are initialized via `init_redis_managers()` and accessed through singleton getters:

* `get_session_manager()` - Session CRUD operations
* `get_token_manager()` - Token blacklist and refresh cache
* `get_rate_limiter()` - Rate limiting checks

**Sources:** [back-end/main.py L18-L23](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L18-L23)

 [back-end/node_internal_api/db.js L38-L50](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/db.js#L38-L50)

---

## Build and Deployment Components

The platform uses a multi-stage setup process orchestrated by shell scripts and Docker Compose.

### Setup Scripts

```mermaid
flowchart TD

Setup["setup.sh / setup.ps1<br>Main Orchestrator"]
PreReq["Check Prerequisites<br>python3, node, npm, docker"]
PyDeps["Install Python Deps<br>pip install -r requirements.txt<br>Virtual env: ../cyvenv"]
NodeDeps["Install Node Deps<br>npm install (root)<br>npm install (node_internal_api)"]
ViteBuild["Build Frontend<br>npm run build<br>Vite compilation"]
DockerDB["Start Databases<br>docker compose up -d<br>postgres + redis"]
InitDB["Initialize Schema<br>CREATE DATABASE cypher_db<br>CREATE EXTENSION pgcrypto"]
GenScripts["Generate Scripts<br>start.sh (production)<br>dev.sh (development)"]

Setup --> PreReq
Setup --> PyDeps
Setup --> NodeDeps
Setup --> ViteBuild
Setup --> DockerDB
Setup --> InitDB
Setup --> GenScripts
```

### Docker Compose Services

The `docker-compose.yml` defines two services:

| Service | Image | Ports | Environment |
| --- | --- | --- | --- |
| `postgres` | `postgres:15` | `5432:5432` | `POSTGRES_DB=cypher_db``POSTGRES_USER=cypher_user``POSTGRES_PASSWORD=cypher_password` |
| `redis` | `redis:alpine` | `6379:6379` | Default configuration |

### Runtime Scripts

**Production Mode (`start.sh`)**:

1. Activate Python virtual environment: `source ../cyvenv/bin/activate`
2. Start Docker services: `docker compose up -d`
3. Launch Flask on port 5000: `python main.py &`
4. Launch Node.js on port 3000: `node node_internal_api/app.js &`
5. Capture PIDs for graceful shutdown

**Development Mode (`dev.sh`)**:

1. Same database setup
2. Flask with debug mode: `FLASK_DEBUG=1 python main.py &`
3. Node.js with hot reload: `nodemon node_internal_api/app.js &`

**Sources:** [back-end/package.json L1-L17](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/package.json#L1-L17)

 [back-end/node_internal_api/package.json L1-L31](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/package.json#L1-L31)

---

## Component Dependency Matrix

The following table maps each component to its runtime and build dependencies:

| Component | Language | Runtime Dependencies | Build Dependencies | Port |
| --- | --- | --- | --- | --- |
| **Flask Service** | Python 3.x | `flask`, `flask-cors`, `paseto`, `sqlalchemy`, `redis`, `python-dotenv` | `requirements.txt` | 5000 |
| **Node.js API** | Node.js 14+ | `express`, `@cloudflare/opaque-ts`, `otplib`, `qrcode`, `pg`, `cors`, `helmet`, `xss-clean` | [node_internal_api/package.json L11-L22](https://github.com/RogueElectron/Cypher1/blob/c60431e6/node_internal_api/package.json#L11-L22) | 3000 |
| **Client Modules** | JavaScript ES6 | `@cloudflare/opaque-ts` (client-side) | `vite`, `@vitejs/plugin-basic-ssl` | N/A |
| **PostgreSQL** | SQL | N/A | Docker image `postgres:15` | 5432 |
| **Redis** | N/A | N/A | Docker image `redis:alpine` | 6379 |

### Cross-Component Communication

```mermaid
flowchart TD

Client["Client Modules<br>(Browser)"]
NodeAPI["Node.js API<br>Port 3000"]
Flask["Flask Service<br>Port 5000"]
PG["PostgreSQL<br>Port 5432"]
Redis["Redis<br>Port 6379"]

Client --> NodeAPI
Client --> Flask
NodeAPI --> Flask
NodeAPI --> PG
Flask --> PG
Flask --> Redis
```

**Sources:** [back-end/main.py L1-L29](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L1-L29)

 [back-end/node_internal_api/app.js L1-L46](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L1-L46)

 [back-end/node_internal_api/db.js L10-L28](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/db.js#L10-L28)