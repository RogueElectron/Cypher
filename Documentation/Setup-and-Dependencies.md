# Setup and Dependencies

> **Relevant source files**
> * [.gitignore](https://github.com/RogueElectron/Cypher/blob/7b7a1583/.gitignore)
> * [back-end/node_internal_api/package-lock.json](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/package-lock.json)
> * [back-end/package-lock.json](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/package-lock.json)
> * [back-end/package.json](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/package.json)
> * [back-end/requirements.txt](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/requirements.txt)
> * [back-end/setup.sh](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/setup.sh)

This document provides a comprehensive guide to setting up the Cypher authentication system development environment and understanding its dependency architecture. It covers the installation process, dependency management for the dual-backend architecture, and configuration requirements for both development and production environments.

For information about the build system and asset compilation, see [Build System and Assets](/RogueElectron/Cypher/5.1-build-system-and-assets). For implementation details of the individual services, see [Implementation Details](/RogueElectron/Cypher/4-implementation-details).

## System Prerequisites

The Cypher authentication system requires specific runtime environments for its dual-backend architecture:

| Requirement | Version | Purpose |
| --- | --- | --- |
| Python 3 | >=3.x | Flask session service runtime |
| Node.js | >=14.0.0 | Internal API and build tooling |
| npm | Latest | Package management |

The Node.js version requirement is enforced in [back-end/node_internal_api/package-lock.json L25-L27](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/package-lock.json#L25-L27)

 through the `engines` field.

Sources: [back-end/setup.sh L26-L38](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/setup.sh#L26-L38)

 [back-end/node_internal_api/package-lock.json L25-L27](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/package-lock.json#L25-L27)

## Project Structure Overview

```mermaid
flowchart TD

GitIgnore[".gitignore<br>Excluded Files"]
EnvFile[".env<br>Environment Variables"]
SetupSh["setup.sh<br>Installation Script"]
StartSh["start.sh<br>Production Startup"]
DevSh["dev.sh<br>Development Startup"]
DistDir["dist/<br>Compiled Frontend Assets"]
AppJs["app.js<br>Node.js API Entry"]
NodePkgJson["package.json<br>Node.js Dependencies"]
NodeModules["node_modules/<br>Node.js Packages"]
MainPy["main.py<br>Flask Service Entry"]
ReqTxt["requirements.txt<br>Python Dependencies"]
PkgJson["package.json<br>Main Build Dependencies"]
VenvDir["venv/<br>Python Virtual Environment"]

subgraph Configuration ["Configuration"]
    GitIgnore
    EnvFile
end

subgraph subGraph3 ["Setup Scripts"]
    SetupSh
    StartSh
    DevSh
end

subgraph back-end/ ["back-end/"]
    MainPy
    ReqTxt
    PkgJson
    VenvDir

subgraph subGraph1 ["Build Artifacts"]
    DistDir
end

subgraph node_internal_api/ ["node_internal_api/"]
    AppJs
    NodePkgJson
    NodeModules
end
end
```

Sources: [.gitignore L1-L6](https://github.com/RogueElectron/Cypher/blob/7b7a1583/.gitignore#L1-L6)

 [back-end/setup.sh L61-L96](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/setup.sh#L61-L96)

## Dependency Architecture

The system employs a multi-layered dependency structure across three distinct runtime environments:

### Node.js Internal API Dependencies

```mermaid
flowchart TD

Nodemon["nodemon@^3.0.1<br>Auto-restart"]
QRCode["qrcode@^1.5.3<br>TOTP QR Generation"]
NodeFetch["node-fetch@^3.3.2<br>HTTP Client"]
XssClean["xss-clean@^0.1.4<br>Input Sanitization"]
DotEnv["dotenv@^17.2.2<br>Environment Loading"]
Express["express@^4.18.2<br>HTTP Server"]
Cors["cors@^2.8.5<br>Cross-Origin Requests"]
CookieParser["cookie-parser@^1.4.7<br>Cookie Handling"]
Helmet["helmet@^8.1.0<br>Security Headers"]
OpaqueTs["@cloudflare/opaque-ts@^0.7.5<br>Zero-knowledge Authentication"]
VoprfTs["@cloudflare/Unsupported markdown: link<br>OPAQUE Protocol Primitives"]
NobleHashes["@noble/Unsupported markdown: link<br>Cryptographic Hashing"]
OtpLib["otplib@^12.0.1<br>TOTP Implementation"]

subgraph Development ["Development"]
    Nodemon
end

subgraph Utilities ["Utilities"]
    QRCode
    NodeFetch
    XssClean
    DotEnv
end

subgraph subGraph1 ["Web Framework"]
    Express
    Cors
    CookieParser
    Helmet
end

subgraph subGraph0 ["Cryptographic Core"]
    OpaqueTs
    VoprfTs
    NobleHashes
    OtpLib
    OpaqueTs --> VoprfTs
    VoprfTs --> NobleHashes
end
```

The Node.js service handles all cryptographic operations, with `@cloudflare/opaque-ts` providing the core zero-knowledge authentication protocol implementation. The `otplib` package manages TOTP generation and verification for two-factor authentication.

Sources: [back-end/node_internal_api/package-lock.json L10-L27](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/package-lock.json#L10-L27)

 [back-end/node_internal_api/package-lock.json L52-L93](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/package-lock.json#L52-L93)

### Flask Service Dependencies

```mermaid
flowchart TD

Flask["flask>=3.0.0<br>Web Framework"]
FlaskCors["flask-cors>=4.0.0<br>CORS Support"]
Paseto["paseto>=1.8.0<br>Token Management"]
Venv["venv/<br>Isolated Python Environment"]
PipCache["pip cache<br>Package Storage"]

Venv --> Flask
Venv --> FlaskCors
Venv --> Paseto

subgraph subGraph1 ["Virtual Environment"]
    Venv
    PipCache
end

subgraph subGraph0 ["Python Dependencies"]
    Flask
    FlaskCors
    Paseto
end
```

The Flask service manages session tokens using PASETO (Platform-Agnostic Security Tokens) for secure, stateless authentication tokens with built-in expiration and refresh capabilities.

Sources: [back-end/requirements.txt L1-L4](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/requirements.txt#L1-L4)

 [back-end/setup.sh L41-L48](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/setup.sh#L41-L48)

### Frontend Build Dependencies

```mermaid
flowchart TD

OpaqueShared["@cloudflare/opaque-ts@^0.7.5<br>Browser Crypto"]
Vite["vite@^7.1.6<br>Module Bundler"]
ESBuild["esbuild@^0.25.10<br>JavaScript Compiler"]
Rollup["rollup@^4.52.0<br>Module Bundler"]
ViteSSL["@vitejs/plugin-basic-ssl@^2.1.0<br>Development SSL"]

subgraph subGraph1 ["Shared Dependencies"]
    OpaqueShared
end

subgraph subGraph0 ["Build System"]
    Vite
    ESBuild
    Rollup
    ViteSSL
    Vite --> ESBuild
    Vite --> Rollup
    Vite --> ViteSSL
end
```

The frontend build system uses Vite for fast development builds and production bundling, with the same OPAQUE library available for client-side cryptographic operations.

Sources: [back-end/package.json L1-L16](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/package.json#L1-L16)

 [back-end/package-lock.json L746-L757](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/package-lock.json#L746-L757)

## Installation Process Flow

```mermaid
flowchart TD

Start["Run setup.sh"]
CheckPrereq["Check Prerequisites<br>python3, node, npm"]
CheckFiles["Verify main.py and package.json<br>Ensure correct directory"]
SetupPython["Create Python Virtual Environment<br>python3 -m venv venv"]
InstallPython["Install Python Dependencies<br>pip install -r requirements.txt"]
InstallMain["Install Main Backend Dependencies<br>npm install"]
InstallNode["Install Node Internal API Dependencies<br>cd node_internal_api && npm install"]
BuildFrontend["Build Frontend Assets<br>npx vite build"]
CreateScripts["Generate Startup Scripts<br>start.sh and dev.sh"]
Complete["Installation Complete"]
Error["Exit with Error"]

Start --> CheckPrereq
CheckPrereq --> CheckFiles
CheckFiles --> SetupPython
SetupPython --> InstallPython
InstallPython --> InstallMain
InstallMain --> InstallNode
InstallNode --> BuildFrontend
BuildFrontend --> CreateScripts
CreateScripts --> Complete
CheckPrereq --> Error
CheckFiles --> Error
```

The installation script [back-end/setup.sh L1-L97](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/setup.sh#L1-L97)

 performs environment validation, dependency installation across both backend services, frontend compilation, and startup script generation in a single automated process.

Sources: [back-end/setup.sh L23-L60](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/setup.sh#L23-L60)

## Development vs Production Configuration

### Development Environment

The development setup enables hot-reloading and debugging features:

```mermaid
flowchart TD

DevSh["dev.sh<br>Development Startup"]
FlaskDebug["FLASK_DEBUG=1<br>Debug Mode"]
Nodemon["nodemon app.js<br>Auto-restart Node.js"]
ViteWatch["Vite Watch Mode<br>Asset Recompilation"]

subgraph subGraph0 ["Development Mode"]
    DevSh
    FlaskDebug
    Nodemon
    ViteWatch
    DevSh --> FlaskDebug
    DevSh --> Nodemon
end
```

Development startup script automatically activates the Python virtual environment and runs both services with development-specific configurations.

Sources: [back-end/setup.sh L78-L91](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/setup.sh#L78-L91)

### Production Environment

The production configuration optimizes for performance and security:

```mermaid
flowchart TD

StartSh["start.sh<br>Production Startup"]
FlaskProd["python main.py<br>Production Flask"]
NodeProd["node app.js<br>Production Node.js"]
StaticAssets["dist/<br>Compiled Assets"]

subgraph subGraph0 ["Production Mode"]
    StartSh
    FlaskProd
    NodeProd
    StaticAssets
    StartSh --> FlaskProd
    StartSh --> NodeProd
    StaticAssets --> FlaskProd
end
```

Production deployment serves pre-compiled static assets and runs both backend services without development tooling overhead.

Sources: [back-end/setup.sh L63-L77](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/setup.sh#L63-L77)

## Environment Configuration

### Ignored Files and Security

The `.gitignore` configuration ensures sensitive files and build artifacts remain excluded from version control:

| Path Pattern | Purpose |
| --- | --- |
| `/cyvenv` | Python virtual environment |
| `/back-end/node_modules` | Node.js dependencies |
| `/back-end/__pycache__` | Python bytecode cache |
| `/back-end/.env` | Environment variables |
| `/back-end/cypher_users.db` | User database |

Sources: [.gitignore L1-L6](https://github.com/RogueElectron/Cypher/blob/7b7a1583/.gitignore#L1-L6)

### Service Ports and Communication

The dual-backend architecture operates on distinct ports:

* **Flask Service**: `http://127.0.0.1:5000` - Session management and template serving
* **Node.js Internal API**: `http://localhost:3000` - Cryptographic operations and TOTP handling

Inter-service communication occurs through HTTP requests, with the Node.js service creating tokens that the Flask service validates and manages.

Sources: [back-end/setup.sh L72](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/setup.sh#L72-L72)

 [back-end/setup.sh L87](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/setup.sh#L87-L87)