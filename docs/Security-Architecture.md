# Security Architecture

> **Relevant source files**
> * [Documentation/Business-Model.md](https://github.com/RogueElectron/Cypher1/blob/c60431e6/Documentation/Business-Model.md)
> * [Documentation/Team-Roles.md](https://github.com/RogueElectron/Cypher1/blob/c60431e6/Documentation/Team-Roles.md)
> * [README.md](https://github.com/RogueElectron/Cypher1/blob/c60431e6/README.md)
> * [back-end/main.py](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py)
> * [back-end/node_internal_api/app.js](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js)
> * [back-end/src/auth.js](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js)

## Purpose and Scope

This document provides a comprehensive analysis of the security architecture underlying the Cypher authentication platform. It examines the cryptographic foundations, defense-in-depth mechanisms, threat model, and security guarantees that enable zero-knowledge authentication.

For implementation details of specific authentication flows, see [Authentication System](/RogueElectron/Cypher1/3-authentication-system). For session and token lifecycle management, see [Session and Token Management](/RogueElectron/Cypher1/3.3-session-and-token-management). For API endpoint security, see [API Reference](/RogueElectron/Cypher1/4.3-api-reference).

---

## Cryptographic Foundations

The Cypher platform builds on three cryptographic pillars, each addressing a distinct security domain: password authentication (OPAQUE), session management (PASETO), and second-factor verification (TOTP).

### OPAQUE Protocol Configuration

The system uses the **OPAQUE-P256** configuration, which implements the OPAQUE protocol specification using the P-256 elliptic curve.

**Key Configuration Parameters:**

| Parameter | Value | Purpose |
| --- | --- | --- |
| Protocol ID | `OpaqueID.OPAQUE_P256` | P-256 curve-based OPAQUE |
| OPRF Seed | `cfg.prng.random(cfg.hash.Nh)` | Oblivious PRF randomization |
| Server Keypair Seed | `cfg.prng.random(cfg.constants.Nseed)` | Authenticated key exchange |
| Hash Function | `cfg.hash` | Cryptographic hash operations |
| Key Derivation | `cfg.ake.deriveAuthKeyPair()` | Server authentication keypair |

The OPAQUE protocol ensures that:

1. **Server never learns password**: Password-based key is derived client-side only
2. **Mutual authentication**: Client authenticates server before revealing credentials
3. **Session key establishment**: Secure shared secret derived without password transmission

**Sources:** [back-end/node_internal_api/app.js L1-L86](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L1-L86)

 [back-end/src/auth.js L1-L10](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L1-L10)

### PASETO Token Architecture

The platform uses **PASETO v4.public** tokens with three cryptographically isolated symmetric keys to prevent token type confusion attacks.

```mermaid
flowchart TD

KeyGen["SymmetricKey.generate(protocol=ProtocolVersion4)"]
IntermediateKey["key<br>(Intermediate Token Key)<br>TTL: 3 minutes"]
SessionKey["session_key<br>(Access Token Key)<br>TTL: 15 minutes"]
RefreshKey["refresh_key<br>(Refresh Token Key)<br>TTL: 7 days"]
CreateIntermediate["paseto.create(key=key, purpose='local')<br>Claims: username, pass_authed"]
CreateAccess["paseto.create(key=session_key)<br>Claims: username, user_id, session_id, type='access'"]
CreateRefresh["paseto.create(key=refresh_key)<br>Claims: username, user_id, session_id,<br>type='refresh', token_id"]
ParseIntermediate["paseto.parse(key=key)"]
ParseAccess["paseto.parse(key=session_key)"]
ParseRefresh["paseto.parse(key=refresh_key)"]

IntermediateKey --> CreateIntermediate
SessionKey --> CreateAccess
RefreshKey --> CreateRefresh
CreateIntermediate --> ParseIntermediate
CreateAccess --> ParseAccess
CreateRefresh --> ParseRefresh

subgraph subGraph2 ["Token Verification"]
    ParseIntermediate
    ParseAccess
    ParseRefresh
end

subgraph subGraph1 ["Token Creation"]
    CreateIntermediate
    CreateAccess
    CreateRefresh
end

subgraph subGraph0 ["PASETO Key Hierarchy"]
    KeyGen
    IntermediateKey
    SessionKey
    RefreshKey
    KeyGen --> IntermediateKey
    KeyGen --> SessionKey
    KeyGen --> RefreshKey
end
```

**Token Type Isolation:**

| Token Type | Symmetric Key | Lifetime | Storage Location | Purpose |
| --- | --- | --- | --- | --- |
| Intermediate | `key` | 180 seconds | HttpOnly cookie | Bridge OPAQUE → TOTP |
| Access | `session_key` | 900 seconds | HttpOnly cookie | API authorization |
| Refresh | `refresh_key` | 604800 seconds | localStorage | Token rotation |

The three-key architecture ensures that:

* A stolen access token cannot be used to generate refresh tokens
* A compromised refresh token cannot forge access tokens
* Intermediate tokens are isolated from session establishment

**Sources:** [back-end/main.py L32-L34](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L32-L34)

 [back-end/main.py L92-L112](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L92-L112)

 [back-end/main.py L215-L249](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L215-L249)

### TOTP Secret Management

Time-based one-time passwords use the **otplib** library with standardized parameters:

**TOTP Configuration:**

| Parameter | Value | Security Rationale |
| --- | --- | --- |
| Algorithm | SHA-1 (RFC 6238) | Authenticator app compatibility |
| Time Step | 30 seconds | Standard TOTP window |
| Verification Window | ±1 step (60s total) | Clock skew tolerance |
| Secret Length | `authenticator.generateSecret()` | Cryptographically random |
| Secret Storage | Encrypted via external service | Database compromise protection |

**Secret Lifecycle:**

1. **Generation**: `authenticator.generateSecret()` creates cryptographically random secret
2. **Temporary Storage**: Held in `totpSecrets` Map during setup (max 5 minutes)
3. **Verification**: `authenticator.verify({ token, secret, window: 1 })`
4. **Persistent Storage**: `database.storeTotpSecret(username, secret)` encrypts before PostgreSQL storage
5. **Retrieval**: `database.getTotpSecret(username)` decrypts on demand

**Sources:** [back-end/node_internal_api/app.js L16](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L16-L16)

 [back-end/node_internal_api/app.js L329-L361](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L329-L361)

 [back-end/node_internal_api/app.js L391-L496](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L391-L496)

---

## Security Layers and Defense-in-Depth

The platform implements a **four-layer security model** where compromise of any single layer does not compromise the entire authentication system.

```mermaid
flowchart TD

TLS["HTTPS/TLS<br>basicSsl Plugin"]
CORS["CORS Middleware<br>Origin Validation:<br>localhost:5000, 127.0.0.1:5000"]
Helmet["helmet() Middleware<br>CSP, HSTS, X-Frame-Options"]
XSS["xss-clean()<br>Input Sanitization"]
OPAQUEClient["OpaqueClient.authInit(password)<br>KE1 Generation"]
OPAQUEServer["OpaqueServer.authInit(KE1)<br>KE2 Response"]
MutualAuth["OpaqueClient.authFinish(KE2)<br>Server Verification + KE3"]
SessionKey["Derived Session Key<br>(Never Transmitted)"]
IntermediateToken["Intermediate Token<br>paseto.create(key=key, exp=180s)"]
TOTPVerify["authenticator.verify(token, secret)<br>30s time window"]
TokenBlacklist["get_token_manager().is_token_blacklisted()"]
SessionCreate["get_session_manager().create_session()<br>Redis TTL: 3600s"]
RateLimit["get_rate_limiter().check_rate_limit()<br>10 req/min per IP"]
TokenRotation["RefreshToken.is_active = False<br>One-time Use Enforcement"]
AuditLog["AuditLog.event_type = 'session_created'<br>PostgreSQL Persistence"]

XSS --> OPAQUEClient
SessionKey --> IntermediateToken
TokenBlacklist --> SessionCreate

subgraph subGraph3 ["Layer 4: Session Management"]
    SessionCreate
    RateLimit
    TokenRotation
    AuditLog
    SessionCreate --> RateLimit
    RateLimit --> TokenRotation
    TokenRotation --> AuditLog
end

subgraph subGraph2 ["Layer 3: Multi-Factor Verification"]
    IntermediateToken
    TOTPVerify
    TokenBlacklist
    IntermediateToken --> TOTPVerify
    TOTPVerify --> TokenBlacklist
end

subgraph subGraph1 ["Layer 2: Cryptographic Authentication"]
    OPAQUEClient
    OPAQUEServer
    MutualAuth
    SessionKey
    OPAQUEClient --> OPAQUEServer
    OPAQUEServer --> MutualAuth
    MutualAuth --> SessionKey
end

subgraph subGraph0 ["Layer 1: Transport Security"]
    TLS
    CORS
    Helmet
    XSS
    TLS --> CORS
    CORS --> Helmet
    Helmet --> XSS
end
```

**Layer Responsibilities:**

1. **Transport Security**: Prevents man-in-the-middle attacks, XSS injection, and cross-origin abuse
2. **Cryptographic Authentication**: Zero-knowledge password verification with mutual authentication
3. **Multi-Factor Verification**: Time-based second factor prevents replay and credential stuffing
4. **Session Management**: Rate limiting, token rotation, and audit trails prevent session hijacking

**Sources:** [back-end/node_internal_api/app.js L27-L46](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L27-L46)

 [back-end/node_internal_api/app.js L72-L77](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L72-L77)

 [back-end/main.py L159-L173](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L159-L173)

 [back-end/main.py L535-L560](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L535-L560)

---

## Threat Model and Attack Mitigation

### Threats Defended Against

```mermaid
flowchart TD

C1["Brute Force"]
F1["Rate Limiting<br>10 req/min per IP"]
C2["Account Enumeration"]
F2["Uniform Error Messages<br>'Authentication failed'"]
C3["Rate Limit Bypass"]
F3["Redis TTL Enforcement<br>Automatic cleanup"]
B1["Token Theft"]
E1["HttpOnly Cookies<br>JavaScript inaccessible"]
B2["Session Hijacking"]
E2["Session Fingerprinting<br>device_fingerprint, user_agent"]
B3["CSRF"]
E3["SameSite=Lax Cookies<br>Cross-site protection"]
B4["Replay Attacks"]
E4["One-time Refresh Tokens<br>is_active = False after use"]
A1["Credential Stuffing"]
D1["OPAQUE Zero-Knowledge<br>No password transmission"]
A2["Password Database Breach"]
D2["opaque_record Storage<br>Cannot reverse to password"]
A3["Man-in-the-Middle"]
D3["Mutual Authentication<br>Client verifies server"]
A4["Phishing"]
D4["Server Binding<br>Cannot replay elsewhere"]

subgraph subGraph2 ["Abuse and DoS"]
    C1
    F1
    C2
    F2
    C3
    F3
    C1 --> F1
    C2 --> F2
    C3 --> F3
end

subgraph subGraph1 ["Session-Based Attacks"]
    B1
    E1
    B2
    E2
    B3
    E3
    B4
    E4
    B1 --> E1
    B2 --> E2
    B3 --> E3
    B4 --> E4
end

subgraph subGraph0 ["Password-Based Attacks"]
    A1
    D1
    A2
    D2
    A3
    D3
    A4
    D4
    A1 --> D1
    A2 --> D2
    A3 --> D3
    A4 --> D4
end
```

**Sources:** [back-end/node_internal_api/app.js L222-L259](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L222-L259)

 [back-end/main.py L307-L386](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L307-L386)

 [back-end/main.py L159-L173](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L159-L173)

### Attack Surface Analysis

| Attack Vector | Vulnerable Component | Mitigation Mechanism | Code Reference |
| --- | --- | --- | --- |
| **Password Interception** | Network layer | OPAQUE never transmits password | [app.js L243-L250](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L243-L250) |
| **Database Breach** | PostgreSQL `users` table | Only `opaque_record` stored (irreversible) | [app.js L197-L200](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L197-L200) |
| **Token Forgery** | PASETO tokens | Cryptographically signed with `SymmetricKey` | [main.py L225-L230](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L225-L230) |
| **Session Fixation** | Session creation | Randomized `session_id = secrets.token_urlsafe(32)` | [main.py L195-L201](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L195-L201) |
| **Replay Attacks** | Refresh token reuse | `is_active = False` after use | [main.py L429](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L429-L429) |
| **TOTP Brute Force** | 6-digit code space | Rate limiting + time window expiry | [main.py L161-L172](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L161-L172) |
| **Cross-Origin Abuse** | API endpoints | CORS restricted to `localhost:5000` | [app.js L72-L77](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L72-L77) |
| **XSS Injection** | Form inputs | `xss-clean()` middleware | [app.js L27](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L27-L27) |
| **Account Lockout DoS** | Failed login attempts | 5-minute unverified account cleanup | [app.js L92-L111](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L92-L111) |

**Sources:** [back-end/node_internal_api/app.js L27-L77](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L27-L77)

 [back-end/main.py L252-L271](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L252-L271)

 [back-end/main.py L418-L429](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L418-L429)

---

## OPAQUE Protocol Security Properties

### Zero-Knowledge Guarantee

The OPAQUE implementation ensures **true zero-knowledge** through the following protocol flow:

```mermaid
sequenceDiagram
  participant OpaqueClient
  participant (Browser)
  participant OpaqueServer
  participant (Node.js)
  participant PostgreSQL
  participant users.opaque_record

  note over OpaqueClient,users.opaque_record: Registration Phase
  OpaqueClient->>OpaqueClient: "client.registerInit(password)
  OpaqueClient->>OpaqueServer: → RegistrationRequest"
  OpaqueServer->>OpaqueServer: "POST /register/init
  OpaqueServer->>OpaqueClient: {registrationRequest}"
  OpaqueClient->>OpaqueClient: "server.registerInit(request, username)
  OpaqueClient->>OpaqueServer: → RegistrationResponse"
  OpaqueServer->>OpaqueServer: "{registrationResponse}"
  OpaqueServer->>PostgreSQL: "client.registerFinish(response, password)
  note over OpaqueClient,users.opaque_record: Authentication Phase (Zero-Knowledge)
  OpaqueClient->>OpaqueClient: → RegistrationRecord"
  OpaqueClient->>OpaqueServer: "POST /register/finish
  OpaqueServer->>PostgreSQL: {record, username}"
  PostgreSQL->>OpaqueServer: "CredentialFile(username, record)
  OpaqueServer->>OpaqueServer: → Serialized opaque_record"
  OpaqueServer->>OpaqueClient: "INSERT opaque_record = base64(serialized)"
  OpaqueClient->>OpaqueClient: "client.authInit(password)
  OpaqueClient->>OpaqueServer: → KE1 (blinded password)"
  OpaqueServer->>OpaqueServer: "POST /login/init
  note over OpaqueClient,(Node.js): CRITICAL: Password never transmitted.
```

**Mathematical Security Properties:**

1. **Password Secrecy**: Password `p` never leaves client. Server only stores `opaque_record = Encrypt(p, server_public_key)`
2. **Forward Secrecy**: Compromised `opaque_record` cannot recover password without server private key
3. **Mutual Authentication**: `KE2` proves server possesses correct `opaque_record`; `KE3` proves client knows password
4. **Session Key Agreement**: Both parties derive identical `session_key` using Diffie-Hellman, but key is never transmitted

**Sources:** [back-end/node_internal_api/app.js L143-L220](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L143-L220)

 [back-end/node_internal_api/app.js L222-L325](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L222-L325)

 [back-end/src/auth.js L239-L293](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L239-L293)

### Credential Storage Security

The `opaque_record` stored in PostgreSQL is cryptographically protected:

```mermaid
flowchart TD

Breach["Database Breach<br>Attacker obtains opaque_record"]
Decrypt["Cannot decrypt without:<br>1. Server private key (serverAkeKeypair)<br>2. User password"]
NoPassword["opaque_record ≠ hash(password)<br>Not reversible"]
Password["User Password<br>(plaintext)"]
ClientRegInit["OpaqueClient.registerInit(password)<br>→ RegistrationRequest"]
ClientRegFinish["OpaqueClient.registerFinish(response, password)<br>→ RegistrationRecord"]
ServerRegInit["OpaqueServer.registerInit(request)<br>→ RegistrationResponse"]
CredFile["CredentialFile(username, record)<br>Contains encrypted password envelope"]
Serialize["credential_file.serialize()<br>→ Uint8Array"]
Base64["Array.from(bytes)<br>Base64 encoding"]
PostgreSQL["PostgreSQL INSERT<br>users.opaque_record = base64"]

ClientRegFinish --> ServerRegInit

subgraph subGraph1 ["Server Storage"]
    ServerRegInit
    CredFile
    Serialize
    Base64
    PostgreSQL
    ServerRegInit --> CredFile
    CredFile --> Serialize
    Serialize --> Base64
    Base64 --> PostgreSQL
end

subgraph subGraph0 ["Client Registration"]
    Password
    ClientRegInit
    ClientRegFinish
    Password --> ClientRegInit
    ClientRegInit --> ClientRegFinish
end

subgraph subGraph2 ["Security Guarantee"]
    Breach
    Decrypt
    NoPassword
    Breach --> Decrypt
    Decrypt --> NoPassword
end
```

**Key Security Feature:** The `opaque_record` is **not a password hash**. It is an encrypted envelope that requires both the server's private key and the user's password to decrypt. A database breach reveals neither passwords nor session keys.

**Sources:** [back-end/node_internal_api/app.js L177-L220](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L177-L220)

 [back-end/node_internal_api/app.js L232-L241](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L232-L241)

---

## Token Security and Lifecycle Management

### Multi-Phase Token Strategy

The platform uses a **three-token system** to isolate authentication phases and minimize exposure windows:

```mermaid
stateDiagram-v2
    [*] --> OPAQUEComplete : "OPAQUE authFinish() success"
    OPAQUEComplete --> IntermediateToken : "POST /api/create-tokenpaseto.create(key=key, exp=180s)"
    IntermediateToken --> TOTPVerification : "Stored in HttpOnly cookiepass_auth_token"
    TOTPVerification --> SessionTokens : "POST /totp/verify-loginauthenticator.verify() → true"
    SessionTokens --> ActiveSession : "POST /api/create-sessionaccess_token (900s)refresh_token (604800s)"
    ActiveSession --> TokenRefresh : "POST /api/refresh-tokenNew access_tokenNew refresh_tokenOld refresh_token.is_active = False"
    TokenRefresh --> ActiveSession : "POST /api/refresh-tokenNew access_tokenNew refresh_tokenOld refresh_token.is_active = False"
    ActiveSession --> TokenBlacklisted : "POST /api/logoutget_token_manager().blacklist_token()"
    TokenBlacklisted --> [*] : "Session terminated"
    IntermediateToken --> ExpiredIntermediate : "180 seconds elapsed"
    ExpiredIntermediate --> [*] : "Must restart login"
    ActiveSession --> ExpiredAccess
    ExpiredAccess --> [*] : "Session expired"
```

**Token Lifecycle Security:**

| Phase | Token Type | Key | Lifetime | Invalidation Mechanism |
| --- | --- | --- | --- | --- |
| **Phase 1** | Intermediate | `key` | 180s | Automatic expiry via PASETO `exp_seconds` |
| **Phase 2** | Access | `session_key` | 900s | Blacklist in Redis + PASETO expiry |
| **Phase 3** | Refresh | `refresh_key` | 604800s | Database `is_active = False` + Redis cache |

**Sources:** [back-end/main.py L92-L112](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L92-L112)

 [back-end/main.py L215-L249](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L215-L249)

 [back-end/main.py L388-L512](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L388-L512)

 [back-end/main.py L515-L560](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L515-L560)

### Refresh Token Rotation Security

The platform enforces **one-time use** refresh tokens with database-backed rotation:

```mermaid
flowchart TD

ParseToken["paseto.parse(<br>  key=refresh_key,<br>  token=refresh_token_str<br>)"]
VerifyDB["RefreshToken.query<br>.filter_by(<br>  token_id=token_id,<br>  is_active=True<br>)"]
MarkUsed["db_token.is_active = False<br>db_token.used_at = utcnow()"]
IssueNew["Generate new token_id<br>Store new RefreshToken<br>refreshed_from = old_token_id"]
GenID["secrets.token_urlsafe(32)<br>→ token_id"]
CreateClaims["refresh_claims = {<br>  username, user_id, session_id,<br>  type: 'refresh',<br>  token_id,<br>  iat: current_time<br>}"]
CreateToken["paseto.create(<br>  key=refresh_key,<br>  claims=refresh_claims,<br>  exp_seconds=604800<br>)"]
DBStore["PostgreSQL INSERT<br>RefreshToken {<br>  token_id,<br>  user_id,<br>  session_id,<br>  is_active = True,<br>  expires_at<br>}"]
RedisCache["get_token_manager()<br>.cache_refresh_token(<br>  token_id,<br>  session_id,<br>  ttl=604800<br>)"]

CreateToken --> DBStore
CreateToken --> RedisCache

subgraph subGraph1 ["Storage (Dual Layer)"]
    DBStore
    RedisCache
end

subgraph subGraph0 ["Refresh Token Creation"]
    GenID
    CreateClaims
    CreateToken
    GenID --> CreateClaims
    CreateClaims --> CreateToken
end

subgraph subGraph2 ["Rotation (One-Time Use)"]
    ParseToken
    VerifyDB
    MarkUsed
    IssueNew
    ParseToken --> VerifyDB
    VerifyDB --> MarkUsed
    MarkUsed --> IssueNew
end
```

**Security Properties:**

1. **Replay Prevention**: Each refresh token can only be used once (`is_active = False` after use)
2. **Audit Trail**: `refreshed_from` column tracks token rotation lineage
3. **Immediate Revocation**: Logout sets `is_revoked = True` for all session tokens
4. **Dual Storage**: Redis provides fast validation; PostgreSQL ensures persistence

**Critical Implementation Detail:** The `token_id` claim inside the PASETO token is **not the token itself** - it's a unique identifier that maps to a database record. This prevents token forgery since attackers cannot create valid `token_id` values.

**Sources:** [back-end/main.py L232-L271](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L232-L271)

 [back-end/main.py L388-L512](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L388-L512)

 [back-end/main.py L542-L553](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L542-L553)

---

## Session Security Mechanisms

### Redis-Backed Session Management

Sessions are stored in **Redis with PostgreSQL fallback** for performance and durability:

```mermaid
flowchart TD

CreateReq["POST /api/create-session<br>{username}"]
RateCheck["get_rate_limiter()<br>.check_rate_limit(<br>  identifier=client_ip,<br>  limit=10,<br>  window_seconds=60<br>)"]
UserQuery["User.query<br>.filter_by(<br>  username=username,<br>  is_active=True<br>)"]
RedisSession["get_session_manager()<br>.create_session(<br>  user_id,<br>  session_data={<br>    username,<br>    ip_address,<br>    user_agent,<br>    device_fingerprint<br>  },<br>  ttl=3600<br>)<br>→ session_id"]
PostgresSession["UserSession INSERT {<br>  session_id,<br>  user_id,<br>  ip_address,<br>  user_agent,<br>  device_fingerprint,<br>  expires_at,<br>  session_data (JSON)<br>}"]
CheckRedis["get_session_manager()<br>.get_session(session_id)"]
RedisHit["Session found in Redis<br>Fast path"]
RedisMiss["Session not in Redis<br>Check PostgreSQL"]
RestoreRedis["UserSession.query<br>.filter_by(session_id)<br>Restore to Redis"]
VerifyExpiry["db_session_obj.is_expired()"]
VerifyUser["session_data['username']<br>== token_username"]
VerifyFingerprint["Compare device_fingerprint<br>(optional strict mode)"]

UserQuery --> RedisSession
RedisHit --> VerifyExpiry
RestoreRedis --> VerifyExpiry

subgraph subGraph3 ["Session Validation"]
    VerifyExpiry
    VerifyUser
    VerifyFingerprint
    VerifyExpiry --> VerifyUser
    VerifyUser --> VerifyFingerprint
end

subgraph subGraph2 ["Session Verification"]
    CheckRedis
    RedisHit
    RedisMiss
    RestoreRedis
    CheckRedis --> RedisHit
    CheckRedis --> RedisMiss
    RedisMiss --> RestoreRedis
end

subgraph subGraph1 ["Dual Storage Layer"]
    RedisSession
    PostgresSession
    RedisSession --> PostgresSession
end

subgraph subGraph0 ["Session Creation Flow"]
    CreateReq
    RateCheck
    UserQuery
    CreateReq --> RateCheck
    RateCheck --> UserQuery
end
```

**Session Security Properties:**

| Security Control | Implementation | Purpose |
| --- | --- | --- |
| **Rate Limiting** | `get_rate_limiter().check_rate_limit(client_ip, 10, 60)` | Prevent session creation abuse |
| **Account Locking** | `user.is_locked()` checks `failed_login_attempts` | Brute force protection |
| **Session Isolation** | Unique `session_id` per login | Prevent session fixation |
| **Device Binding** | `device_fingerprint` in session data | Detect session hijacking |
| **Automatic Expiry** | Redis TTL 3600s + PostgreSQL `expires_at` | Limit exposure window |

**Sources:** [back-end/main.py L150-L304](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L150-L304)

 [back-end/main.py L343-L366](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L343-L366)

### Token Blacklisting and Revocation

Access tokens are blacklisted in Redis upon logout to prevent use of unexpired tokens:

```mermaid
flowchart TD

VerifyReq["POST /api/verify-access<br>{access_token}"]
CheckBlacklist["get_token_manager()<br>.is_token_blacklisted(access_token)"]
Reject["Return 401<br>'Token blacklisted'"]
LogoutReq["POST /api/logout<br>{access_token, refresh_token}"]
ParseAccess["paseto.parse(<br>  key=session_key,<br>  token=access_token<br>)"]
ExtractSession["access_claims.get('session_id')"]
BlacklistAccess["get_token_manager()<br>.blacklist_token(<br>  access_token,<br>  ttl=900<br>)"]
DeleteRedis["get_session_manager()<br>.delete_session(session_id)"]
RevokeRefresh["RefreshToken.query<br>.filter_by(session_id)<br>.update({<br>  is_active: False,<br>  is_revoked: True<br>})"]
DeactivateSession["UserSession.query<br>.filter_by(session_id)<br>.update({<br>  is_active: False<br>})"]

ExtractSession --> BlacklistAccess

subgraph subGraph1 ["Token Revocation"]
    BlacklistAccess
    DeleteRedis
    RevokeRefresh
    DeactivateSession
    BlacklistAccess --> DeleteRedis
    DeleteRedis --> RevokeRefresh
    RevokeRefresh --> DeactivateSession
end

subgraph subGraph0 ["Logout Flow"]
    LogoutReq
    ParseAccess
    ExtractSession
    LogoutReq --> ParseAccess
    ParseAccess --> ExtractSession
end

subgraph subGraph2 ["Future Access Checks"]
    VerifyReq
    CheckBlacklist
    Reject
    VerifyReq --> CheckBlacklist
    CheckBlacklist --> Reject
end
```

**Blacklist Strategy:**

* **Storage**: Redis with TTL matching token lifetime (900s for access tokens)
* **Scope**: Only active tokens need blacklisting; expired tokens rejected by PASETO parser
* **Cleanup**: Automatic via Redis TTL expiration

**Sources:** [back-end/main.py L515-L560](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L515-L560)

 [back-end/main.py L317-L319](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L317-L319)

---

## Transport and Communication Security

### Middleware Stack

The Node.js API implements a comprehensive security middleware stack:

```mermaid
flowchart TD

Incoming["Incoming HTTP Request"]
XSSClean["app.use(xss())<br>Sanitize request body/query/params<br>Remove malicious HTML/JavaScript"]
Helmet["app.use(helmet({<br>  hsts: false,<br>  contentSecurityPolicy: {<br>    defaultSrc: ['self'],<br>    scriptSrc: ['self'],<br>    styleSrc: ['self', 'unsafe-inline'],<br>    imgSrc: ['self', 'data:'],<br>    objectSrc: ['none']<br>  },<br>  crossOriginResourcePolicy: 'same-origin'<br>})"]
CORS["app.use(cors({<br>  origin: [<br>    'Unsupported markdown: link',<br>    'Unsupported markdown: link'<br>  ],<br>  methods: ['GET', 'POST', 'PUT', 'DELETE'],<br>  credentials: true<br>})"]
JSON["app.use(express.json())<br>Parse JSON request bodies"]
RouteHandler["Route Handler<br>(e.g., POST /login/init)"]

subgraph subGraph0 ["Request Processing Order"]
    Incoming
    XSSClean
    Helmet
    CORS
    JSON
    RouteHandler
    Incoming --> XSSClean
    XSSClean --> Helmet
    Helmet --> CORS
    CORS --> JSON
    JSON --> RouteHandler
end
```

**Middleware Security Functions:**

| Middleware | Purpose | Configuration | Attack Vector Mitigated |
| --- | --- | --- | --- |
| `xss-clean()` | Sanitize inputs | Default settings | XSS injection, HTML injection |
| `helmet()` | Security headers | CSP, X-Frame-Options, HSTS | Clickjacking, MIME sniffing, XSS |
| `cors()` | Origin validation | Whitelist localhost:5000 | Cross-origin abuse, CSRF |
| `express.json()` | Body parsing | Size limits (default) | JSON bomb DoS |

**Content Security Policy (CSP):**

* `defaultSrc: ['self']` - Only load resources from same origin
* `scriptSrc: ['self']` - No inline scripts or external script domains
* `styleSrc: ['self', 'unsafe-inline']` - Inline styles allowed for UI flexibility
* `imgSrc: ['self', 'data:']` - Support QR code data URLs for TOTP setup
* `objectSrc: ['none']` - Block plugins and embedded objects

**Sources:** [back-end/node_internal_api/app.js L27-L79](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L27-L79)

### Cookie Security Configuration

Access tokens and intermediate tokens use secure cookie attributes:

| Cookie Attribute | Value | Security Purpose |
| --- | --- | --- |
| `HttpOnly` | True (implicit via Flask) | Prevent JavaScript access |
| `SameSite` | `Lax` | CSRF protection (cross-site read-only) |
| `Max-Age` | 180s (intermediate), 900s (access) | Automatic expiry |
| `Secure` | True (production HTTPS) | Encrypt in transit |
| `Path` | `/` | Scope to entire application |

**Client-Side Cookie Management:**

```javascript
// Intermediate token storage (auth.js:313-314)
const passAuthCookie = `pass_auth_token=${tokenResult.token}; Max-Age=180; SameSite=Lax; Path=/`;
document.cookie = passAuthCookie;

// Cookie cleanup after session creation (auth.js:446)
document.cookie = 'pass_auth_token=; Max-Age=0; Path=/; SameSite=Lax';
```

**Sources:** [back-end/src/auth.js L313-L314](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L313-L314)

 [back-end/src/auth.js L446](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L446-L446)

---

## Security Properties and Guarantees

### Mathematical Security Guarantees

The Cypher platform provides **provable security properties** based on cryptographic foundations:

| Security Property | Cryptographic Basis | Implementation | Guarantee |
| --- | --- | --- | --- |
| **Password Secrecy** | OPAQUE protocol (RFC draft) | `OpaqueClient.authInit()` never transmits password | Server cannot learn password, even with MitM |
| **Forward Secrecy** | P-256 ECDH key exchange | `cfg.ake.deriveAuthKeyPair()` ephemeral keys | Compromised long-term keys don't reveal past sessions |
| **Mutual Authentication** | OPAQUE KE2/KE3 messages | `client.authFinish(ke2)` verifies server | Client proves server holds correct `opaque_record` |
| **Token Integrity** | PASETO v4 AEAD | `paseto.create()` with `SymmetricKey` | Tokens tamper-evident and authenticated |
| **Session Isolation** | Cryptographic randomness | `secrets.token_urlsafe(32)` for session/token IDs | Session IDs unguessable (256-bit entropy) |

**Sources:** [back-end/node_internal_api/app.js L82-L86](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L82-L86)

 [back-end/src/auth.js L243-L286](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L243-L286)

### Breach Resistance Analysis

**Database Breach Scenario:**

```mermaid
flowchart TD

OpaqueRecord["users.opaque_record<br>(base64-encoded)"]
TOTPSecret["users.totp_secret<br>(encrypted)"]
SessionData["UserSession.session_data<br>(JSON)"]
RefreshTokens["RefreshToken.token_hash<br>(not actual token)"]
A1["Decrypt opaque_record?"]
A2["Decrypt totp_secret?"]
A3["Forge session tokens?"]
A4["Reuse refresh_token?"]
F1["FAIL:<br>Requires serverAkeKeypair.private_key<br>(memory-only, regenerated on restart)"]
F2["FAIL:<br>Requires encryption service key<br>(external Python service)"]
F3["FAIL:<br>Requires session_key SymmetricKey<br>(memory-only, regenerated on restart)"]
F4["FAIL:<br>token_hash ≠ actual token<br>PASETO tokens not in database"]

OpaqueRecord --> A1
TOTPSecret --> A2
SessionData --> A3
RefreshTokens --> A4
A1 --> F1
A2 --> F2
A3 --> F3
A4 --> F4

subgraph subGraph2 ["Security Outcomes"]
    F1
    F2
    F3
    F4
end

subgraph subGraph1 ["Attack Attempts"]
    A1
    A2
    A3
    A4
end

subgraph subGraph0 ["Compromised Data"]
    OpaqueRecord
    TOTPSecret
    SessionData
    RefreshTokens
end
```

**Key Security Feature:** All cryptographic keys (`key`, `session_key`, `refresh_key`, `serverAkeKeypair`) are **generated at runtime and never persisted**. A database breach reveals no usable secrets.

**Sources:** [back-end/main.py L32-L34](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L32-L34)

 [back-end/node_internal_api/app.js L82-L86](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L82-L86)

### Time-Bound Security Model

All security mechanisms enforce **strict time limits** to minimize exposure:

| Component | Lifetime | Enforcement Mechanism | Rationale |
| --- | --- | --- | --- |
| **Unverified Account** | 300s | `setTimeout()` cleanup | Prevent incomplete registration abuse |
| **Intermediate Token** | 180s | PASETO `exp_seconds` | Bridge OPAQUE → TOTP only |
| **Access Token** | 900s | PASETO `exp_seconds` + blacklist | Limit stolen token impact |
| **Refresh Token** | 604800s | Database `expires_at` + one-time use | Balance usability and security |
| **Redis Session** | 3600s | Redis TTL | Automatic cache invalidation |
| **TOTP Code** | 60s | `authenticator.verify(window=1)` | Standard time-based window |
| **Rate Limit Window** | 60s | Redis counter TTL | Per-minute request limits |

**Automatic Cleanup:** The system uses **zero-maintenance expiry** - Redis TTLs and PASETO expiration eliminate the need for background cleanup jobs.

**Sources:** [back-end/node_internal_api/app.js L92-L111](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L92-L111)

 [back-end/main.py L109](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L109-L109)

 [back-end/main.py L228-L229](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L228-L229)

 [back-end/node_internal_api/app.js L441-L445](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L441-L445)

---

## Security Audit and Monitoring

### Audit Logging

All authentication events are logged to the `AuditLog` table for compliance and forensics:

```css
# Session creation audit (main.py:277-291)
audit_log = AuditLog(
    event_type='session_created',
    event_category='AUTH',
    severity='INFO',
    user_id=user.id,
    session_id=session_id,
    ip_address=client_ip,
    user_agent=request.headers.get('User-Agent', ''),
    success=True
)
audit_log.set_event_details({
    'session_duration': '15 minutes',
    'refresh_token_duration': '7 days'
})
```

**Audit Event Categories:**

| Event Type | Trigger | Information Captured |
| --- | --- | --- |
| `session_created` | Successful TOTP verification | user_id, session_id, IP, user agent |
| `token_refreshed` | Access token refresh | old_token_id → new_token_id lineage |
| `session_terminated` | Logout | session_id, termination reason |
| `auth_failed` | Invalid OPAQUE/TOTP | username, IP (no password data) |
| `rate_limit_exceeded` | Abuse detection | IP, endpoint, violation count |

**Sources:** [back-end/main.py L277-L291](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L277-L291)

### Security Monitoring Points

Key monitoring metrics for security operations:

1. **Failed Authentication Rate**: Unusual spike indicates brute force or credential stuffing
2. **Token Refresh Patterns**: Abnormal refresh frequency suggests token theft
3. **Session Fingerprint Changes**: Device fingerprint mismatch during token refresh
4. **Rate Limit Violations**: Per-IP abuse tracking via `get_rate_limiter()`
5. **Unverified Account Accumulation**: Monitor `unverifiedAccounts` Map size
6. **Redis Cache Miss Rate**: High miss rate on `get_session()` suggests DoS or cache poisoning

**Sources:** [back-end/main.py L159-L173](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L159-L173)

 [back-end/node_internal_api/app.js L90-L111](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L90-L111)

---

This security architecture establishes **defense-in-depth** through cryptographic isolation, time-bound tokens, and comprehensive audit trails. The mathematical guarantees of OPAQUE, combined with PASETO's stateless verification and TOTP's second factor, create a system where compromise of any single component does not compromise overall security.