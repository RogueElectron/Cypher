# Cypher - Zero-Knowledge Authentication Platform

[![Tech Stack](https://img.shields.io/badge/Stack-Node.js%20%7C%20Flask%20%7C%20PostgreSQL%20%7C%20Redis-red?style=for-the-badge)](#)

> **Revolutionary Zero-Knowledge Authentication Platform** - Passwords never leave your device, even during registration and login.

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
- **Docker** (optional, for containerized deployment)

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

###  Documentation Suite
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
- **[Team Roles](docs/Team-Roles.md)** - Team structure and responsibilities

### for an index of  the complete docs 
- **[Documentation index](/docs/README.md)**

## Technical Specifications

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Vanilla JS + Vite | Zero-knowledge client operations |
| **Node.js API** | Express + OPAQUE | Cryptographic protocol handling |
| **Flask Service** | Flask + PASETO | Session management & tokens |
| **Database** | PostgreSQL | Persistent credential storage |
| **Cache** | Redis | Session & rate limiting |
| **Protocol** | OPAQUE (P-256) | Zero-knowledge authentication |
| **Tokens** | PASETO v4.local | Stateless session management |

## Live Demo

**Frontend Interface**: http://localhost:5000
- Interactive registration and login flows
- Real-time authentication visualization
- Responsive design with security indicators

## License

This project is developed for educational and research purposes as part of the Digitopia Hackathon. See individual component licenses for usage terms.

## Contributing

We welcome contributions! Please see our [Development Guide](docs/Development-and-Deployment.md) for setup instructions and contribution guidelines.
