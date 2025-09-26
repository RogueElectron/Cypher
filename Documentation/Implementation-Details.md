# Implementation Details

> **Relevant source files**
> * [back-end/main.py](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py)
> * [back-end/node_internal_api/app.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js)
> * [back-end/src/auth.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js)

This document provides a technical deep dive into the implementation of each major component of the Cypher authentication system. It covers the core architectural patterns, data structures, and code entities that enable the zero-knowledge authentication flow.

For specific API documentation and endpoint details, see [Node.js Internal API](/RogueElectron/Cypher/4.1-node.js-internal-api) and [Flask Session Service](/RogueElectron/Cypher/4.2-flask-session-service). For frontend implementation specifics, see [Client-Side Components](/RogueElectron/Cypher/4.3-client-side-components).

## Core Architecture Implementation

The Cypher system implements a dual-backend architecture where cryptographic operations are isolated from session management. This separation enables specialized handling of OPAQUE protocol operations and PASETO token lifecycle management.

### Service Communication Pattern

```mermaid
flowchart TD

OpaqueClient["OpaqueClient"]
AuthLiveVisualization["AuthLiveVisualization"]
sessionManager["sessionManager"]
OpaqueServer["OpaqueServer"]
database["createKVStorage()"]
totpSecrets["totpSecrets Map"]
unverifiedAccounts["unverifiedAccounts Map"]
paseto_keys["key, session_key, refresh_key"]
active_sessions["active_sessions dict"]
active_refresh_tokens["active_refresh_tokens dict"]

OpaqueClient --> OpaqueServer
OpaqueServer --> paseto_keys
OpaqueServer --> active_sessions
sessionManager --> active_sessions
sessionManager --> active_refresh_tokens

subgraph subGraph2 ["Flask Service :5000"]
    paseto_keys
    active_sessions
    active_refresh_tokens
end

subgraph subGraph1 ["Node.js Internal API :3000"]
    OpaqueServer
    database
    totpSecrets
    unverifiedAccounts
    OpaqueServer --> database
    OpaqueServer --> totpSecrets
    OpaqueServer --> unverifiedAccounts
end

subgraph subGraph0 ["Client Browser"]
    OpaqueClient
    AuthLiveVisualization
    sessionManager
    AuthLiveVisualization --> OpaqueClient
end
```

**Sources:** [back-end/node_internal_api/app.js L1-L470](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L1-L470)

 [back-end/main.py L1-L339](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L1-L339)

 [back-end/src/auth.js L1-L475](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L1-L475)

## Key Data Structures and Storage

### Node.js Storage Implementation

The Node.js service uses in-memory storage structures optimized for cryptographic operations:

| Storage Component | Type | Purpose | Key Methods |
| --- | --- | --- | --- |
| `database` | `createKVStorage()` | OPAQUE credentials | `store()`, `lookup()` |
| `totpSecrets` | `Map` | TOTP secrets per user | `set()`, `get()`, `delete()` |
| `unverifiedAccounts` | `Map` | Cleanup timeouts | `set()`, `has()`, `delete()` |
| `global.userSessions` | `Map` | OPAQUE expected values | `set()`, `get()`, `delete()` |

### Flask Storage Implementation

The Flask service manages token lifecycle with persistent session tracking:

| Storage Component | Type | Purpose | Cleanup Strategy |
| --- | --- | --- | --- |
| `active_sessions` | `dict` | Session metadata | Manual cleanup on logout |
| `active_refresh_tokens` | `dict` | Refresh token registry | Automatic cleanup on refresh |

**Sources:** [back-end/node_internal_api/app.js L45-L61](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L45-L61)

 [back-end/node_internal_api/app.js L79-L82](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L79-L82)

 [back-end/main.py L17-L18](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L17-L18)

## OPAQUE Protocol Implementation

### Server-Side OPAQUE Configuration

```mermaid
flowchart TD

cfg["getOpaqueConfig(OpaqueID.OPAQUE_P256)"]
oprfSeed["cfg.prng.random(cfg.hash.Nh)"]
serverKeypairSeed["cfg.prng.random(cfg.constants.Nseed)"]
serverAkeKeypair["cfg.ake.deriveAuthKeyPair(serverKeypairSeed)"]
akeKeypairExport["akeKeypairExport object"]
OpaqueServer["new OpaqueServer(cfg, oprfSeed, akeKeypairExport)"]

cfg --> oprfSeed
cfg --> serverKeypairSeed
serverKeypairSeed --> serverAkeKeypair
serverAkeKeypair --> akeKeypairExport
cfg --> OpaqueServer
oprfSeed --> OpaqueServer
akeKeypairExport --> OpaqueServer
```

The `OpaqueServer` instance is initialized with P-256 curve configuration and cryptographically secure random seeds for OPRF operations and AKE keypair generation.

**Sources:** [back-end/node_internal_api/app.js L74-L112](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L74-L112)

### Registration Flow Implementation

```mermaid
sequenceDiagram
  participant O as OpaqueClient
  participant I as /register/init
  participant F as /register/finish
  participant K as createKVStorage()

  O->>I: "RegistrationRequest.serialize()"
  I->>I: "RegistrationRequest.deserialize(cfg, serRegistrationRequest)"
  I->>I: "server.registerInit(deSerReq, username)"
  I-->>O: "regResponse.serialize()"
  O->>F: "RegistrationRecord.serialize()"
  F->>F: "RegistrationRecord.deserialize(cfg, record)"
  F->>F: "new CredentialFile(username, deserRec)"
  F->>K: "database.store(username, credential_file.serialize())"
  F->>F: "scheduleAccountCleanup(username)"
```

**Sources:** [back-end/node_internal_api/app.js L118-L192](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L118-L192)

## TOTP Implementation Details

### TOTP Secret Management

The system uses `otplib.authenticator` for TOTP operations with the following key functions:

* `authenticator.generateSecret()` - Creates base32-encoded secrets
* `authenticator.keyuri(username, service, secret)` - Generates otpauth:// URIs
* `authenticator.verify({token, secret, window})` - Validates TOTP codes with time window

### QR Code Generation Process

```mermaid
flowchart TD

username["username"]
service["'Cypher'"]
secret["authenticator.generateSecret()"]
keyuri["authenticator.keyuri()"]
otpauthUrl["otpauth://totp/..."]
QRCode["QRCode.toDataURL()"]
qrCodeDataURL["data:image/png;base64..."]

username --> keyuri
service --> keyuri
secret --> keyuri
keyuri --> otpauthUrl
otpauthUrl --> QRCode
QRCode --> qrCodeDataURL
```

**Sources:** [back-end/node_internal_api/app.js L302-L334](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L302-L334)

## Token System Architecture

### PASETO Token Types and Keys

The Flask service implements three distinct token types using separate cryptographic keys:

```mermaid
flowchart TD

key["key (SymmetricKey)"]
session_key["session_key (SymmetricKey)"]
refresh_key["refresh_key (SymmetricKey)"]
pass_auth["pass_auth_token<br>exp_seconds=180"]
access_token["access_token<br>exp_seconds=900"]
refresh_token["refresh_token<br>exp_seconds=2592000"]
pass_claims["username, pass_authed"]
access_claims["username, session_id, type, iat"]
refresh_claims["username, session_id, type, token_id, iat"]

key --> pass_auth
session_key --> access_token
refresh_key --> refresh_token
pass_auth --> pass_claims
access_token --> access_claims
refresh_token --> refresh_claims

subgraph subGraph2 ["Claims Structure"]
    pass_claims
    access_claims
    refresh_claims
end

subgraph subGraph1 ["Token Types"]
    pass_auth
    access_token
    refresh_token
end

subgraph subGraph0 ["Token Creation"]
    key
    session_key
    refresh_key
end
```

**Sources:** [back-end/main.py L13-L15](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L13-L15)

 [back-end/main.py L44-L56](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L44-L56)

 [back-end/main.py L105-L133](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L105-L133)

## Client-Side Authentication State Management

### Live Visualization System

The `AuthLiveVisualization` class provides real-time feedback during authentication flows:

```mermaid
classDiagram
    class AuthLiveVisualization {
        +steps: authenticationSteps[]
        +init()
        +renderSteps()
        +activateStep(stepId)
        +completeStep(stepId)
        +updateSecurityStatus(message, type)
    }
    class authenticationSteps {
        +id: string
        +icon: string
        +title: string
        +description: string
        +dataFlow: string
    }
    AuthLiveVisualization --> authenticationSteps
```

The visualization tracks nine distinct steps from password input through 2FA completion, providing transparency into the zero-knowledge authentication process.

**Sources:** [back-end/src/auth.js L18-L153](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L18-L153)

### Session Token Management

Client-side token handling uses cookie storage with specific security attributes:

* `pass_auth_token` - `Max-Age=180; SameSite=Lax; Path=/`
* Session tokens managed via `sessionManager.setTokens()`
* Automatic cleanup of temporary tokens after session establishment

**Sources:** [back-end/src/auth.js L315-L451](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L315-L451)

## Inter-Service Communication Pattern

### Node.js to Flask API Calls

The Node.js service makes HTTP requests to Flask endpoints during authentication flows:

```mermaid
sequenceDiagram
  participant N as Node.js (:3000)
  participant F as Flask (:5000)

  note over N,F: After OPAQUE Success
  N->>F: "POST /api/create-token {username}"
  F-->>N: "{token: pass_auth_token}"
  note over N,F: During TOTP Verification
  N->>F: "POST /api/verify-token {token, username}"
  F-->>N: "{valid: true, claims}"
  note over N,F: After TOTP Success
  N->>F: "POST /api/create-session {username}"
  F-->>N: "{access_token, refresh_token}"
```

Each service maintains its specialized responsibilities while coordinating through well-defined API contracts.

**Sources:** [back-end/node_internal_api/app.js L256-L287](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L256-L287)

 [back-end/node_internal_api/app.js L376-L430](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L376-L430)

 [back-end/node_internal_api/app.js L421-L455](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L421-L455)

## Security Implementation Patterns

### Account Verification Timeout

The system implements automatic cleanup of unverified registrations:

* `VERIFICATION_TIMEOUT = 5 * 60 * 1000` (5 minutes)
* `scheduleAccountCleanup(username)` sets cleanup timeouts
* `unverifiedAccounts.has(username)` prevents premature cleanup
* Successful TOTP verification calls `clearTimeout()` and `unverifiedAccounts.delete()`

### CORS and Security Headers

Both services implement security hardening:

**Node.js Security:**

* `helmet()` with CSP configuration
* `xss-clean()` middleware
* CORS restricted to `localhost:5000`

**Flask Security:**

* CORS with `supports_credentials=True`
* Origin restrictions matching Node.js configuration

**Sources:** [back-end/node_internal_api/app.js L23-L70](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L23-L70)

 [back-end/node_internal_api/app.js L84-L101](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L84-L101)

 [back-end/main.py L11](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L11-L11)