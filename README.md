![Demo Status](https://github.com/RogueElectron/Cypher/actions/workflows/linux-test.yml/badge.svg)
![Repo size](https://img.shields.io/github/repo-size/RogueElectron/Cypher)
![CodeQL](https://github.com/RogueElectron/Cypher/actions/workflows/github-code-scanning/codeql/badge.svg)
![Last commit](https://img.shields.io/github/last-commit/RogueElectron/Cypher)
![License](https://img.shields.io/github/license/RogueElectron/Cypher?cacheSeconds=3600)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/RogueElectron/Cypher)
# Cypher - Zero-Knowledge Authentication Platform

# Won 3rd place in DIGITOPIA egypt 2025 CyberSecurity track

> **Revolutionary Zero-Knowledge Authentication Platform** - Passwords never leave your device, even during registration and login.

PS: current docs are deprecated, will not re-write until done with current changes

## Key Highlights
- **Zero-Knowledge Authentication (OPAQUE):** Passwords never transmitted or stored.
- **Dual-Service Isolation:** Node.js handles cryptography; Flask manages sessions.
- **Stateless Tokens (PASETO):** Safer JWT alternative with built-in tamper protection.
- **Redis + PostgreSQL:** Balances speed and durability for real-world scalability.
- **Full Automation:** End-to-end testing with Playwright for protocol correctness.
- **CI/CD:** Automated testing and deployment.

## What Makes Cypher Special

**Cypher** is a cutting-edge authentication platform that implements **zero-knowledge password authentication** using the OPAQUE protocol. Unlike traditional systems where passwords are transmitted and stored (even if hashed), Cypher ensures that passwords never leave the client's device.

### Advanced Architecture
- **Two-Service Design**: Isolated cryptographic operations (Node.js) and session management (Flask)
- **Stateless Tokens**: PASETO-based authentication tokens (no JWT vulnerabilities)
- **Dual Storage**: Redis for performance, PostgreSQL for durability
- **Real-time Sync**: Multi-tab session synchronization with automatic token refresh

## Quick Start

### Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.8+ and **pip**
- **PostgreSQL** 15+
- **Redis** 7+
- **Docker**

Then run the setup.sh, then generate_secrets.sh and the start.sh script and OFF YOU GO

### Helper Scripts
- **setup.sh** - Sets up the environment
- **start.sh** - Starts the application
- **dev.sh** - Starts the application in development mode (hot reload enabled)
- **stop.sh** - Stops the application
- **reset_databases.sh** - Resets the databases
- **clear_databases.sh** - Clears the databases
- **generate_secrets.sh** - Generates OPAQUE secrets (oprf seeds and server private and public key)

## Project Structure

```
Cypher/
├── backend/                     # Application backend
│   ├── Flask-server/            # Flask web application
│   │   ├── main.py                 # Flask application entry point
│   │   ├── requirements.txt        # Python dependencies
│   │   └── __init__.py
│   ├── database/                # Python database modules
│   │   ├── database_config.py      # PostgreSQL & Redis config
│   │   ├── encryption_manager.py   # Encryption & key rotation
│   │   ├── models.py               # SQLAlchemy models
│   │   ├── redis_manager.py        # Redis operations
│   │   └── __init__.py
│   ├── node_internal_api/       # Node.js cryptographic service
│   │   ├── app.js                  # Express OPAQUE server
│   │   ├── db.js                   # Database operations
│   │   └── package.json
│   └── redis.conf               # Redis configuration
├── front-end/                   # Frontend assets
│   ├── src/                     # JavaScript source
│   │   ├── auth.js                 # Client-side authentication
│   │   ├── register.js             # Registration flow
│   │   ├── session-manager.js      # Token lifecycle
│   │   └── index.js                # Main entry
│   ├── static/                  # Static assets
│   │   └── dist/                   # Compiled output (vite build)
│   ├── templates/               # HTML templates
│   ├── package.json                # Frontend dependencies
│   └── vite.config.js              # Vite build configuration
├── scripts/                     # DevOps scripts
│   ├── setup.sh                    # Initial setup
│   ├── start.sh                    # Start application
│   ├── dev.sh                      # Development mode
│   ├── init_db.py                  # Database initialization
│   └── *_databases.sh              # Database management
├── test/                        # Automation tests
├── docs/                        # Comprehensive documentation
│   ├── Overview.md                 # System overview
│   ├── API-Reference.md            # Complete API documentation
│   ├── Authentication-System.md    # Security architecture
│   ├── System-Architecture.md      # Technical architecture
│   └── README.md                   # Documentation index
├── docker-compose.yml           # Infrastructure
├── .env                         # Environment variables
└── README.md                       # This file
```

## Documentation

### Removed old documentation
### working on major changes so won't write new docs until done

## Technical Specifications

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Vanilla JS + Vite | Zero-knowledge client operations |
| **Node.js Internal API** | Express + OPAQUE | Cryptographic protocol handling |
| **Flask Internal API** | FLASK + PASETO  | Internal API for session management |
| **Flask Service** | Flask + PASETO | Session management & tokens |
| **Database** | PostgreSQL | Persistent credential storage |
| **Cache** | Redis | Session & rate limiting |
| **Tokens** | PASETO v4.local | Stateless session management |
| **Automation** | Playwright + otplib | Demo & testing workflows |

