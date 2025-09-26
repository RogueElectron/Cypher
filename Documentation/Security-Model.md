# Security Model

> **Relevant source files**
> * [back-end/main.py](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py)
> * [back-end/node_internal_api/app.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js)
> * [back-end/static/dist/opaque_client.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/static/dist/opaque_client.js)

This document describes the cryptographic security architecture and authentication mechanisms implemented in the Cypher system. It covers the zero-knowledge authentication protocols, multi-factor authentication implementation, token-based session security, and data protection mechanisms.

For information about the authentication workflows and user flows, see [Authentication Workflows](/RogueElectron/Cypher/3-authentication-workflows). For implementation details of individual services, see [Implementation Details](/RogueElectron/Cypher/4-implementation-details).

## Zero-Knowledge Authentication Architecture

The Cypher system implements a zero-knowledge authentication model using the OPAQUE protocol, ensuring that user passwords are never transmitted or stored in plaintext on the server.

### OPAQUE Protocol Implementation

```mermaid
flowchart TD

OpaqueClient["OpaqueClient Class"]
BlindElement["blind() function"]
FinalizeAuth["finalize() function"]
RandomBlinder["randomBlinder() generation"]
OpaqueServer["OpaqueServer instance"]
RegisterInit["/register/init endpoint"]
RegisterFinish["/register/finish endpoint"]
LoginInit["/login/init endpoint"]
LoginFinish["/login/finish endpoint"]
CredentialFile["CredentialFile storage"]
SJCL["SJCL crypto library"]
KeyDerivation["Key derivation functions"]
PRF["Pseudo-random functions"]

OpaqueServer --> SJCL
BlindElement --> RegisterInit
RegisterInit --> FinalizeAuth
FinalizeAuth --> RegisterFinish

subgraph subGraph2 ["Cryptographic Components"]
    SJCL
    KeyDerivation
    PRF
    SJCL --> KeyDerivation
    KeyDerivation --> PRF
end

subgraph subGraph1 ["Server Side (app.js)"]
    OpaqueServer
    RegisterInit
    RegisterFinish
    LoginInit
    LoginFinish
    CredentialFile
    RegisterInit --> OpaqueServer
    RegisterFinish --> CredentialFile
    LoginInit --> OpaqueServer
    LoginFinish --> OpaqueServer
end

subgraph subGraph0 ["Client Side (opaque_client.js)"]
    OpaqueClient
    BlindElement
    FinalizeAuth
    RandomBlinder
    OpaqueClient --> BlindElement
    BlindElement --> RandomBlinder
    OpaqueClient --> FinalizeAuth
end
```

The OPAQUE implementation ensures that:

* Passwords are blinded on the client before transmission
* The server never receives plaintext passwords
* Authentication keys are derived through cryptographic protocols
* Password verification occurs without password exposure

Sources: [back-end/node_internal_api/app.js L108-L112](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L108-L112)

 [back-end/static/dist/opaque_client.js L1-L3](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/static/dist/opaque_client.js#L1-L3)

### Key Exchange and Session Establishment

The system implements a secure key exchange mechanism that generates session keys without exposing authentication credentials.

```mermaid
sequenceDiagram
  participant C as Client (auth.js)
  participant N as Node API (app.js)
  participant F as Flask Service (main.py)

  note over C,F: OPAQUE Authentication Phase
  C->>N: registerInit(username, blindedPassword)
  N-->>C: registrationResponse
  C->>N: registerFinish(record)
  N-->>C: Registration success
  note over C,F: Login Phase
  C->>N: authInit(KE1)
  N-->>C: KE2 response
  C->>N: authFinish(KE3)
  note over N: Verify session_key
  N->>F: POST /api/create-token
  F-->>N: pass_auth_token
  N-->>C: Authentication token
```

Sources: [back-end/node_internal_api/app.js L194-L298](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L194-L298)

 [back-end/main.py L36-L56](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L36-L56)

## Multi-Factor Authentication System

### TOTP Implementation

The system enforces Time-based One-Time Password (TOTP) authentication as a mandatory second factor, implemented using the `otplib` authenticator module.

```mermaid
flowchart TD

GenerateSecret["authenticator.generateSecret()"]
CreateURI["authenticator.keyuri()"]
GenerateQR["QRCode.toDataURL()"]
VerifySetup["/totp/verify-setup"]
VerifyLogin["/totp/verify-login"]
ValidateToken["authenticator.verify()"]
CreateSession["/api/create-session"]
TOTPSecrets["totpSecrets Map"]
UnverifiedAccounts["unverifiedAccounts Map"]

VerifySetup --> TOTPSecrets
TOTPSecrets --> ValidateToken

subgraph Storage ["Storage"]
    TOTPSecrets
    UnverifiedAccounts
    TOTPSecrets --> UnverifiedAccounts
end

subgraph subGraph1 ["TOTP Login Flow"]
    VerifyLogin
    ValidateToken
    CreateSession
    VerifyLogin --> ValidateToken
    ValidateToken --> CreateSession
end

subgraph subGraph0 ["TOTP Setup Flow"]
    GenerateSecret
    CreateURI
    GenerateQR
    VerifySetup
    GenerateSecret --> CreateURI
    CreateURI --> GenerateQR
    GenerateQR --> VerifySetup
end
```

The TOTP system provides:

* RFC 6238 compliant time-based tokens
* QR code generation for authenticator app setup
* Token verification with configurable time windows
* Account cleanup for unverified registrations

Sources: [back-end/node_internal_api/app.js L302-L464](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L302-L464)

 [back-end/node_internal_api/app.js L80-L81](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L80-L81)

### Account Verification and Cleanup

```mermaid
flowchart TD

Registration["User Registration"]
TOTPSetup["/totp/setup"]
QRGeneration["QR Code Generation"]
UserScan["User Scans QR"]
TOTPVerify["/totp/verify-setup"]
AccountActive["Account Active"]
RetryVerification["Retry Verification"]
ScheduleCleanup["scheduleAccountCleanup()"]
TimeoutCheck["5 minute timeout"]
CleanupAccount["cleanupUnverifiedAccount()"]
ClearTimeout["clearTimeout()"]
RemoveCredentials["Remove from database"]
RemoveTOTP["Remove TOTP secrets"]
RemoveTracking["Remove from unverifiedAccounts"]

Registration --> TOTPSetup
TOTPSetup --> QRGeneration
QRGeneration --> UserScan
UserScan --> TOTPVerify
TOTPVerify --> AccountActive
TOTPVerify --> RetryVerification
Registration --> ScheduleCleanup
ScheduleCleanup --> TimeoutCheck
TimeoutCheck --> CleanupAccount
TimeoutCheck --> ClearTimeout
CleanupAccount --> RemoveCredentials
CleanupAccount --> RemoveTOTP
CleanupAccount --> RemoveTracking
```

Sources: [back-end/node_internal_api/app.js L84-L101](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L84-L101)

 [back-end/node_internal_api/app.js L415-L418](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L415-L418)

## Token-Based Session Security

### PASETO Token Architecture

The Flask service implements PASETO (Platform-Agnostic Security Tokens) for secure session management, providing authenticated encryption and preventing many classes of token-based attacks.

```mermaid
flowchart TD

PassAuthKey["key: SymmetricKey"]
SessionKey["session_key: SymmetricKey"]
RefreshKey["refresh_key: SymmetricKey"]
CreateToken["/api/create-token"]
VerifyToken["/api/verify-token"]
CreateSession["/api/create-session"]
RefreshToken["/api/refresh-token"]
VerifyAccess["/api/verify-access"]
Logout["/api/logout"]
ActiveSessions["active_sessions dict"]
ActiveRefreshTokens["active_refresh_tokens dict"]

PassAuthKey --> CreateToken
SessionKey --> CreateSession
SessionKey --> VerifyAccess
RefreshKey --> RefreshToken
CreateSession --> ActiveSessions
CreateSession --> ActiveRefreshTokens
RefreshToken --> ActiveSessions
RefreshToken --> ActiveRefreshTokens
Logout --> ActiveSessions
Logout --> ActiveRefreshTokens

subgraph subGraph2 ["Token Storage"]
    ActiveSessions
    ActiveRefreshTokens
end

subgraph subGraph1 ["Token Lifecycle"]
    CreateToken
    VerifyToken
    CreateSession
    RefreshToken
    VerifyAccess
    Logout
    CreateToken --> VerifyToken
end

subgraph subGraph0 ["Token Types and Keys"]
    PassAuthKey
    SessionKey
    RefreshKey
end
```

Sources: [back-end/main.py L13-L18](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L13-L18)

 [back-end/main.py L94-L151](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L94-L151)

### Token Security Features

The PASETO implementation provides multiple security layers:

| Feature | Implementation | Purpose |
| --- | --- | --- |
| **Symmetric Encryption** | `SymmetricKey.generate()` | Prevents token forgery |
| **Expiration Times** | `exp_seconds` parameter | Limits token lifetime |
| **Token Revocation** | `active_refresh_tokens` tracking | Enables logout functionality |
| **Session Binding** | `session_id` claims | Links access and refresh tokens |
| **Automatic Rotation** | Refresh token invalidation | Prevents replay attacks |

The token structure includes:

* **Pass Auth Tokens**: Short-lived (180s) for OPAQUE→TOTP transition
* **Access Tokens**: Medium-lived (900s) for API access
* **Refresh Tokens**: Long-lived (30 days) for session maintenance

Sources: [back-end/main.py L49-L56](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L49-L56)

 [back-end/main.py L105-L133](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L105-L133)

 [back-end/main.py L153-L239](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L153-L239)

## Cryptographic Foundations

### OPAQUE Protocol Configuration

The system uses OPAQUE with P-256 elliptic curve cryptography for password-authenticated key exchange:

```mermaid
flowchart TD

OpaqueID["OPAQUE_P256"]
CurveConfig["P-256 Curve"]
HashFunction["SHA-256"]
OprfSeed["OPRF Seed"]
ServerKeypair["Server AKE Keypair"]
ServerKeypairSeed["serverKeypairSeed"]
OpaqueServerInit["OpaqueServer constructor"]
ConfigObject["cfg: OpaqueConfig"]
ServerInstance["server: OpaqueServer"]

HashFunction --> ConfigObject
OprfSeed --> OpaqueServerInit
ServerKeypair --> OpaqueServerInit

subgraph subGraph2 ["Server Instance"]
    OpaqueServerInit
    ConfigObject
    ServerInstance
    ConfigObject --> OpaqueServerInit
    OpaqueServerInit --> ServerInstance
end

subgraph subGraph1 ["Key Generation"]
    OprfSeed
    ServerKeypair
    ServerKeypairSeed
    OprfSeed --> ServerKeypairSeed
    ServerKeypairSeed --> ServerKeypair
end

subgraph subGraph0 ["OPAQUE Configuration"]
    OpaqueID
    CurveConfig
    HashFunction
    OpaqueID --> CurveConfig
    CurveConfig --> HashFunction
end
```

Sources: [back-end/node_internal_api/app.js L74-L112](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L74-L112)

### Cryptographic Key Management

The system implements secure key derivation and management:

* **OPRF Seeds**: Generated using cryptographically secure random number generation
* **Server Keypairs**: Derived using authenticated key exchange protocols
* **Session Keys**: Generated through OPAQUE key exchange protocols
* **TOTP Secrets**: Generated using `authenticator.generateSecret()`

Sources: [back-end/node_internal_api/app.js L75-L77](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L75-L77)

 [back-end/node_internal_api/app.js L310](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L310-L310)

## Security Middleware and Headers

### Express Security Configuration

The Node.js service implements comprehensive security middleware through Helmet and XSS protection:

```mermaid
flowchart TD

XSSClean["xss() middleware"]
HelmetConfig["helmet() configuration"]
CSPConfig["contentSecurityPolicy"]
CORSConfig["cors() configuration"]
DefaultSrc["defaultSrc: 'self'"]
ScriptSrc["scriptSrc: 'self'"]
StyleSrc["styleSrc: 'self', 'unsafe-inline'"]
ImgSrc["imgSrc: 'self', 'data:'"]
ObjectSrc["objectSrc: 'none'"]
AllowedOrigins["origins: localhost:5000"]
AllowedMethods["methods: GET, POST, PUT, DELETE"]
AllowedHeaders["headers: Content-Type, Authorization"]
Credentials["credentials: true"]

CSPConfig --> DefaultSrc
CSPConfig --> ScriptSrc
CSPConfig --> StyleSrc
CSPConfig --> ImgSrc
CSPConfig --> ObjectSrc
CORSConfig --> AllowedOrigins
CORSConfig --> AllowedMethods
CORSConfig --> AllowedHeaders
CORSConfig --> Credentials

subgraph subGraph2 ["CORS Policy"]
    AllowedOrigins
    AllowedMethods
    AllowedHeaders
    Credentials
end

subgraph subGraph1 ["Security Headers"]
    DefaultSrc
    ScriptSrc
    StyleSrc
    ImgSrc
    ObjectSrc
end

subgraph subGraph0 ["Security Middleware Stack"]
    XSSClean
    HelmetConfig
    CSPConfig
    CORSConfig
    XSSClean --> HelmetConfig
    HelmetConfig --> CSPConfig
end
```

Sources: [back-end/node_internal_api/app.js L23-L42](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L23-L42)

 [back-end/node_internal_api/app.js L65-L70](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L65-L70)

### Content Security Policy

The CSP configuration prevents common web vulnerabilities:

* Restricts resource loading to same-origin
* Blocks inline scripts (except where explicitly allowed)
* Prevents object/embed tag exploitation
* Enables upgrade of insecure requests

Sources: [back-end/node_internal_api/app.js L27-L37](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L27-L37)

## Data Protection Mechanisms

### In-Memory Storage Security

The system uses ephemeral in-memory storage to minimize data exposure:

```mermaid
flowchart TD

KVStorage["createKVStorage() Map"]
TOTPSecrets["totpSecrets Map"]
UnverifiedAccounts["unverifiedAccounts Map"]
UserSessions["global.userSessions Map"]
ActiveSessions["active_sessions dict"]
ActiveRefreshTokens["active_refresh_tokens dict"]
CredentialFiles["OPAQUE CredentialFile objects"]
TOTPKeys["TOTP secret keys"]
SessionData["Session metadata"]
TokenData["Token tracking data"]

KVStorage --> CredentialFiles
TOTPSecrets --> TOTPKeys
UnverifiedAccounts --> SessionData
UserSessions --> SessionData
ActiveSessions --> SessionData
ActiveRefreshTokens --> TokenData

subgraph subGraph2 ["Data Types"]
    CredentialFiles
    TOTPKeys
    SessionData
    TokenData
end

subgraph subGraph1 ["Flask Storage"]
    ActiveSessions
    ActiveRefreshTokens
end

subgraph subGraph0 ["Node.js Storage"]
    KVStorage
    TOTPSecrets
    UnverifiedAccounts
    UserSessions
end
```

The in-memory approach provides:

* **No persistent storage** of sensitive authentication data
* **Automatic cleanup** on service restart
* **Reduced attack surface** through ephemeral data handling
* **Session isolation** between service instances

Sources: [back-end/node_internal_api/app.js L45-L61](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L45-L61)

 [back-end/node_internal_api/app.js L79-L82](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L79-L82)

 [back-end/main.py L17-L18](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L17-L18)

### Credential Protection

OPAQUE credentials are stored as serialized `CredentialFile` objects containing:

* Encrypted password verification data
* User identity binding
* Protocol-specific cryptographic parameters

The credentials never contain plaintext passwords and can only be used for zero-knowledge verification protocols.

Sources: [back-end/node_internal_api/app.js L171-L174](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L171-L174)

 [back-end/node_internal_api/app.js L213-L215](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/node_internal_api/app.js#L213-L215)