![Demo Status](https://github.com/RogueElectron/Cypher/actions/workflows/linux-test.yml/badge.svg)
![Repo size](https://img.shields.io/github/repo-size/RogueElectron/Cypher)
![CodeQL](https://github.com/RogueElectron/Cypher/actions/workflows/github-code-scanning/codeql/badge.svg)
![Last commit](https://img.shields.io/github/last-commit/RogueElectron/Cypher)
![License](https://img.shields.io/github/license/RogueElectron/Cypher?cacheSeconds=3600)
![Digitopia-stage](https://custom-icon-badges.herokuapp.com/badge/Digitopia_stage-FINALS-000000?style=for-the-badge&logo=check-circle-fill&logoColor=white&labelColor=000000)
# Cypher - Zero-Knowledge Authentication Platform

> **Revolutionary Zero-Knowledge Authentication Platform** - Passwords never leave your device, even during registration and login.

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

Then run the setup.sh and the start.sh scripts and OFF YOU GO

### Helper Scripts
- **setup.sh** - Sets up the environment
- **start.sh** - Starts the application
- **dev.sh** - Starts the application in development mode (hot reload enabled)
- **stop.sh** - Stops the application
- **reset_databases.sh** - Resets the databases
- **clear_databases.sh** - Clears the databases

## Project Structure

```
Cypher/
├── back-end/                    # Main application backend
│   ├── src/                     # Python source modules
│   │   ├── auth.js                 # Client-side authentication
│   │   ├── register.js             # Registration flow
│   │   ├── session-manager.js      # Token lifecycle management
│   │   ├── models.py               # Database models
│   │   ├── encryption_manager.py   # Encryption utilities
│   │   └── redis_manager.py        # Redis operations
│   ├── node_internal_api/       # Node.js cryptographic service
│   │   ├── app.js                  # Express application
│   │   ├── db.js                   # Database operations
│   │   └── package.json
│   ├── static/                  # Frontend assets
│   │   ├── dist/                   # Compiled JavaScript
│   │   └── templates/              # HTML templates
│   ├── migrations/              # Database migrations
│   ├── main.py                     # Flask application
│   ├── requirements.txt            # Python dependencies
│   └── docker-compose.yml          # Infrastructure
├── docs/                        # Comprehensive documentation
│   ├── Overview.md                 # System overview
│   ├── API-Reference.md            # Complete API documentation
│   ├── Authentication-System.md    # Security architecture
│   ├── System-Architecture.md      # Technical architecture
│   └── README.md                   # Documentation index
├── Documentation/               # Legacy documentation (being migrated)
└── README.md                       # This file
```

## Documentation

### Digitopia-specific docs
- **[Team Roles](docs/Team-Roles.md)** - Team structure and responsibilities
- **[business model](docs/business-model.md)** - Business model

### Complete Documentation Suite
- **[Overview](docs/Overview.md)** - System introduction and capabilities
- **[API Reference](docs/API-Reference.md)** - Complete endpoint documentation
- **[Authentication System](docs/Authentication-System.md)** - Security architecture deep-dive
- **[System Architecture](docs/System-Architecture.md)** - Technical design details
- **[Authentication Workflows](docs/Authentication-Workflows.md)** - Flow diagrams
- **[Development and Deployment](docs/Development-and-Deployment.md)** - Setup and contribution guide

### Quick Links
- **[Installation and Setup](docs/Installation-and-Setup.md)** - Get started in minutes
- **[Running the Application](docs/Running-the-Application.md)** - Launch instructions
- **[Security Architecture](docs/Security-Architecture.md)** - Threat model and design

### Full docs
The full documentation has much more, Access the index here
- **[Documentation index](docs/README.md)**

## Technical Specifications

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Vanilla JS + Vite | Zero-knowledge client operations |
| **Node.js API** | Express + OPAQUE | Cryptographic protocol handling |
| **Flask Service** | Flask + PASETO | Session management & tokens |
| **Database** | PostgreSQL | Persistent credential storage |
| **Cache** | Redis | Session & rate limiting |
| **Tokens** | PASETO v4.local | Stateless session management |
| **Automation** | Playwright + otplib | Demo & testing workflows |

