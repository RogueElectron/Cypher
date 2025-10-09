# Authentication Workflows

> **Relevant source files**
> * [back-end/main.py](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py)
> * [back-end/node_internal_api/app.js](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js)
> * [back-end/src/auth.js](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js)
> * [back-end/src/register.js](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/register.js)

## Purpose and Scope

This document provides detailed step-by-step documentation of the three core authentication workflows in the Cypher platform: **registration**, **login**, and **logout**. Each workflow is documented with sequence diagrams, endpoint mappings, and code references to actual implementation files.

This page focuses on the **orchestration and sequencing** of authentication operations. For implementation details of the underlying cryptographic protocols, see [OPAQUE Protocol Implementation](/RogueElectron/Cypher1/3.1-opaque-protocol-implementation) and [TOTP Two-Factor Authentication](/RogueElectron/Cypher1/3.2-totp-two-factor-authentication). For token management mechanics, see [Session and Token Management](/RogueElectron/Cypher1/3.3-session-and-token-management). For client-side implementation details, see [Registration Flow (Client-Side)](/RogueElectron/Cypher1/5.1-registration-flow-(client-side)) and [Login Flow (Client-Side)](/RogueElectron/Cypher1/5.2-login-flow-(client-side)).

---

## Registration Workflow

The registration workflow implements a two-phase process: OPAQUE credential enrollment followed by mandatory TOTP setup. New users must complete both phases within a 5-minute window before the account becomes active.

### OPAQUE Registration Phase

```mermaid
sequenceDiagram
  participant User
  participant Register as register.js
  participant NodeAPI as Node.js API
  participant NodeAPI as Node.js API
  participant FlaskAPI as Flask API
  participant FlaskAPI as Flask API
  participant Postgres as PostgreSQL

  User->>Register: "Enter username/password"
  note over Register: "Step: input"
  Register->>Register: "OpaqueClient.registerInit(password)"
  note over Register: "Step: generate-keys
  Register->>NodeAPI: "POST /register/init
  note over Register: "Step: registration-request"
  NodeAPI->>Postgres: {username, registrationRequest}"
  NodeAPI->>NodeAPI: "Check if username exists"
  NodeAPI-->>Register: "OpaqueServer.registerInit()"
  note over Register: "Step: server-response"
  Register->>Register: "{registrationResponse}"
  note over Register: "Step: finalize
  Register->>NodeAPI: "client.registerFinish(response)"
  NodeAPI->>NodeAPI: "POST /register/finish
  NodeAPI->>NodeAPI: {username, record}"
  NodeAPI->>Postgres: "RegistrationRecord.deserialize()"
  NodeAPI->>NodeAPI: "new CredentialFile(username, record)"
  note over NodeAPI,Port3000: "5-minute timeout starts"
  NodeAPI-->>Register: "store(username, serialized_credential)"
```

**Sources:** [back-end/src/register.js L223-L356](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/register.js#L223-L356)

 [back-end/node_internal_api/app.js L143-L220](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L143-L220)

#### Key Endpoints and Functions

| Component | Endpoint/Function | Purpose | Code Reference |
| --- | --- | --- | --- |
| Client | `OpaqueClient.registerInit(password)` | Generate blinded password request | [register.js L266](https://github.com/RogueElectron/Cypher1/blob/c60431e6/register.js#L266-L266) |
| Client | `client.registerFinish(response)` | Complete OPAQUE protocol, generate record | [register.js L306](https://github.com/RogueElectron/Cypher1/blob/c60431e6/register.js#L306-L306) |
| Node.js | `POST /register/init` | Process initial registration request | [app.js L143-L175](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L143-L175) |
| Node.js | `POST /register/finish` | Store credential file, start cleanup timer | [app.js L177-L220](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L177-L220) |
| Node.js | `scheduleAccountCleanup(username)` | 5-minute timeout for TOTP setup | [app.js L103-L111](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L103-L111) |
| Database | `database.store(username, credential)` | Persist OPAQUE record as base64 | [app.js L200](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L200-L200) |

**Sources:** [back-end/src/register.js L260-L330](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/register.js#L260-L330)

 [back-end/node_internal_api/app.js L143-L220](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L143-L220)

### TOTP Setup Phase

After OPAQUE registration completes, the UI transitions from password entry to TOTP setup. The user has 5 minutes to complete this phase before the account is automatically deleted.

```mermaid
sequenceDiagram
  participant User
  participant Register as register.js
  participant NodeAPI as Node.js API
  participant NodeAPI as Node.js API
  participant TotpSecrets as totpSecrets Map
  participant Postgres as PostgreSQL

  note over Register: "Registration form hidden
  Register->>NodeAPI: "POST /totp/setup
  NodeAPI->>NodeAPI: {username}"
  NodeAPI->>TotpSecrets: "authenticator.generateSecret()"
  NodeAPI->>NodeAPI: "totpSecrets.set(username, secret)"
  NodeAPI->>NodeAPI: "authenticator.keyuri(username, 'Cypher', secret)"
  NodeAPI-->>Register: "QRCode.toDataURL(otpauthUrl)"
  Register->>Register: "{secret, qrCode, otpauthUrl}"
  note over Register: "Step: totp-setup"
  User->>User: "Display QR code and secret"
  User->>Register: "Scan QR with authenticator app"
  Register->>NodeAPI: "Enter 6-digit TOTP code"
  NodeAPI->>TotpSecrets: "POST /totp/verify-setup
  NodeAPI->>NodeAPI: {username, token}"
  loop ["TOTP Valid"]
    NodeAPI->>NodeAPI: "secret = totpSecrets.get(username)"
    NodeAPI->>Postgres: "authenticator.verify({token, secret})"
    NodeAPI->>Postgres: "markAccountVerified(username)"
    NodeAPI->>TotpSecrets: "storeTotpSecret(username, secret)"
    NodeAPI->>NodeAPI: "enableTotp(username)"
    note over NodeAPI,Port3000: "Account now active"
    NodeAPI-->>Register: "totpSecrets.delete(username)"
    Register->>Register: "clearTimeout(cleanupTimer)"
    NodeAPI-->>Register: "{success: true}"
    note over User: "User can retry within 5-min window"
  end
```

**Sources:** [back-end/src/register.js L360-L492](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/register.js#L360-L492)

 [back-end/node_internal_api/app.js L329-L389](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L329-L389)

#### TOTP Setup Components

| Component | Endpoint/Function | Purpose | Code Reference |
| --- | --- | --- | --- |
| Client | `generateTotpSecret()` | Request TOTP secret generation | [register.js L360-L397](https://github.com/RogueElectron/Cypher1/blob/c60431e6/register.js#L360-L397) |
| Client | `displayServerQrCode(qrCode, url)` | Render QR code image for scanning | [register.js L399-L415](https://github.com/RogueElectron/Cypher1/blob/c60431e6/register.js#L399-L415) |
| Node.js | `POST /totp/setup` | Generate secret, create QR code | [app.js L329-L361](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L329-L361) |
| Node.js | `POST /totp/verify-setup` | Verify initial TOTP code | [app.js L363-L389](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L363-L389) |
| Node.js | `markAccountVerified(username)` | Persist TOTP secret, enable account | [app.js L113-L126](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L113-L126) |
| Node.js | `cleanupUnverifiedAccount(username)` | Delete account if TOTP not completed | [app.js L94-L101](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L94-L101) |

**Sources:** [back-end/src/register.js L360-L492](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/register.js#L360-L492)

 [back-end/node_internal_api/app.js L329-L389](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L329-L389)

### Account State Transitions

```mermaid
stateDiagram-v2
    [*] --> OpaqueRegistered : "POST /register/finish"
    OpaqueRegistered --> TotpSetupPending : "POST /totp/setup"
    TotpSetupPending --> AccountActive : "POST /totp/verify-setup(valid code)"
    TotpSetupPending --> [*] : "Can now login"
    AccountActive --> [*] : "Can now login"
```

**Sources:** [back-end/node_internal_api/app.js L92-L126](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L92-L126)

---

## Login Workflow

The login workflow consists of four sequential phases: OPAQUE authentication, intermediate token issuance, TOTP verification, and session establishment. All four phases must succeed for a user to gain access.

### Phase 1: OPAQUE Authentication

```mermaid
sequenceDiagram
  participant User
  participant Auth as auth.js
  participant NodeAPI as Node.js API
  participant NodeAPI as Node.js API
  participant UserSessions as global.userSessions
  participant Postgres as PostgreSQL

  User->>Auth: "Enter username/password"
  note over Auth: "Step: input"
  Auth->>Auth: "OpaqueClient.authInit(password)"
  note over Auth: "Step: ke1-generation
  Auth->>NodeAPI: "POST /login/init
  note over Auth: "Step: send-ke1"
  NodeAPI->>Postgres: {username, serke1}"
  NodeAPI->>NodeAPI: "lookup(username) → credFileBytes"
  NodeAPI->>NodeAPI: "CredentialFile.deserialize(credFileBytes)"
  NodeAPI->>NodeAPI: "KE1.deserialize(serke1)"
  NodeAPI->>UserSessions: "server.authInit(ke1, record, credential_id)"
  note over UserSessions: "Store expected value for finish"
  NodeAPI-->>Auth: "userSessions.set(username, expected)"
  note over Auth: "Step: server-ke2"
  Auth->>Auth: "{ser_ke2}"
  Auth->>Auth: "KE2.deserialize(ser_ke2)"
  note over Auth: "Step: verify-server
  Auth->>NodeAPI: "client.authFinish(ke2)"
  note over Auth: "Step: send-ke3"
  NodeAPI->>UserSessions: "POST /login/finish
  NodeAPI->>NodeAPI: {username, serke3}"
  NodeAPI->>NodeAPI: "expected = userSessions.get(username)"
  loop ["OPAQUE Valid"]
    NodeAPI->>UserSessions: "KE3.deserialize(serke3)"
    note over NodeAPI,Port3000: "Proceed to Phase 2"
    NodeAPI-->>Auth: "server.authFinish(ke3, expected)"
    note over User: "Invalid password"
  end
```

**Sources:** [back-end/src/auth.js L205-L356](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L205-L356)

 [back-end/node_internal_api/app.js L222-L325](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L222-L325)

### Phase 2: Intermediate Token Issuance

After successful OPAQUE authentication, an intermediate token (`pass_auth_token`) is created to bridge the gap between password verification and TOTP verification. This token has a 3-minute lifetime.

```

```

**Sources:** [back-end/node_internal_api/app.js L283-L314](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L283-L314)

 [back-end/main.py L92-L112](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L92-L112)

 [back-end/src/auth.js L293-L352](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L293-L352)

#### Intermediate Token Flow

| Component | Endpoint/Function | Purpose | Code Reference |
| --- | --- | --- | --- |
| Node.js | Calls Flask after OPAQUE success | Request intermediate token | [app.js L284-L290](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L284-L290) |
| Flask | `POST /api/create-token` | Issue PASETO token with 3-min TTL | [main.py L92-L112](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L92-L112) |
| Flask | `paseto.create(key, claims, exp_seconds=180)` | Token with `pass_authed: true` claim | [main.py L105-L110](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L105-L110) |
| Client | `document.cookie = 'pass_auth_token=...'` | Store token in cookie | [auth.js L313](https://github.com/RogueElectron/Cypher1/blob/c60431e6/auth.js#L313-L313) |

**Sources:** [back-end/node_internal_api/app.js L283-L314](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L283-L314)

 [back-end/main.py L92-L112](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L92-L112)

### Phase 3: TOTP Verification

```mermaid
sequenceDiagram
  participant User
  participant Auth as auth.js
  participant NodeAPI as Node.js API
  participant NodeAPI as Node.js API
  participant FlaskAPI as Flask API
  participant FlaskAPI as Flask API
  participant Postgres as PostgreSQL

  User->>Auth: "Enter 6-digit TOTP code"
  Auth->>Auth: "getCookieValue('pass_auth_token')"
  Auth->>NodeAPI: "POST /totp/verify-login
  NodeAPI->>FlaskAPI: {username, token, passAuthToken}"
  FlaskAPI->>FlaskAPI: "POST /api/verify-token
  FlaskAPI->>FlaskAPI: {token: passAuthToken, username}"
  FlaskAPI-->>NodeAPI: "paseto.parse(key, token)"
  note over NodeAPI,Port3000: "Intermediate token valid"
  NodeAPI->>Postgres: "Verify claims: username match, pass_authed=true"
  NodeAPI->>NodeAPI: "{valid: true, claims}"
  loop ["TOTP Valid"]
    NodeAPI->>NodeAPI: "getTotpSecret(username)"
    note over NodeAPI,Port3000: "Proceed to Phase 4"
    NodeAPI-->>Auth: "authenticator.verify({token, secret, window: 1})"
    note over User: "Invalid code - can retry"
  end
```

**Sources:** [back-end/src/auth.js L376-L458](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L376-L458)

 [back-end/node_internal_api/app.js L391-L496](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L391-L496)

 [back-end/main.py L114-L148](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L114-L148)

#### TOTP Verification Components

| Component | Endpoint/Function | Purpose | Code Reference |
| --- | --- | --- | --- |
| Client | `getCookieValue('pass_auth_token')` | Retrieve intermediate token | [auth.js L405](https://github.com/RogueElectron/Cypher1/blob/c60431e6/auth.js#L405-L405) |
| Client | TOTP form submission handler | Send code + token to server | [auth.js L379-L458](https://github.com/RogueElectron/Cypher1/blob/c60431e6/auth.js#L379-L458) |
| Node.js | `POST /totp/verify-login` | Validate intermediate token + TOTP | [app.js L391-L496](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L391-L496) |
| Flask | `POST /api/verify-token` | Verify intermediate token claims | [main.py L114-L148](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L114-L148) |
| Node.js | `authenticator.verify({token, secret, window: 1})` | Verify 6-digit code (±30 sec window) | [app.js L441-L445](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L441-L445) |

**Sources:** [back-end/src/auth.js L376-L458](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L376-L458)

 [back-end/node_internal_api/app.js L391-L496](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L391-L496)

### Phase 4: Session Establishment

After successful TOTP verification, the Node.js API requests session creation from Flask. Flask creates both Redis and PostgreSQL sessions, then issues access and refresh tokens.

```

```

**Sources:** [back-end/node_internal_api/app.js L452-L487](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L452-L487)

 [back-end/main.py L150-L304](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L150-L304)

 [back-end/src/auth.js L436-L453](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L436-L453)

#### Session Creation Components

| Component | Endpoint/Function | Purpose | Code Reference |
| --- | --- | --- | --- |
| Node.js | Calls Flask after TOTP success | Request session creation | [app.js L453-L461](https://github.com/RogueElectron/Cypher1/blob/c60431e6/app.js#L453-L461) |
| Flask | `POST /api/create-session` | Create session, issue tokens | [main.py L150-L304](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L150-L304) |
| Flask | `get_session_manager().create_session()` | Create Redis session with 1-hour TTL | [main.py L195-L201](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L195-L201) |
| Flask | `UserSession(session_id, user_id, expires_at)` | Persist session to PostgreSQL | [main.py L204-L213](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L204-L213) |
| Flask | `paseto.create(session_key, claims, exp_seconds=900)` | 15-minute access token | [main.py L225-L230](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L225-L230) |
| Flask | `paseto.create(refresh_key, claims, exp_seconds=604800)` | 7-day refresh token | [main.py L244-L249](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L244-L249) |
| Flask | `RefreshToken(token_id, session_id)` | Store refresh token in database | [main.py L252-L263](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L252-L263) |
| Flask | `get_token_manager().cache_refresh_token()` | Cache refresh token in Redis | [main.py L266-L271](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L266-L271) |
| Client | `sessionManager.setTokens(access, refresh, expires)` | Store tokens, schedule refresh | [auth.js L439-L443](https://github.com/RogueElectron/Cypher1/blob/c60431e6/auth.js#L439-L443) |

**Sources:** [back-end/main.py L150-L304](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L150-L304)

 [back-end/src/auth.js L436-L453](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L436-L453)

### Complete Login Flow State Machine

```mermaid
stateDiagram-v2
    [*] --> EnterCredentials : "User visits /api/login"
    EnterCredentials --> OpaqueInit : "Submit username/password"
    OpaqueInit --> OpaqueFinish : "KE1 generated, sent to server"
    OpaqueFinish --> IntermediateToken : "KE3 verified, OPAQUE success"
    IntermediateToken --> TotpInput : "pass_auth_token in cookie (180s)"
    TotpInput --> TotpVerify : "User enters 6-digit code"
    TotpVerify --> SessionCreated : "TOTP valid"
    SessionCreated --> [*] : "Redirect to / with tokens"
    OpaqueFinish --> EnterCredentials : "Invalid password (401)"
    TotpVerify --> TotpInput : "Invalid TOTP (400)"
    TotpInput --> EnterCredentials : "Token expired (401)"
```

**Sources:** [back-end/src/auth.js L205-L470](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js#L205-L470)

 [back-end/node_internal_api/app.js L222-L496](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L222-L496)

---

## Logout Workflow

The logout workflow performs comprehensive cleanup: access token blacklisting, session deletion from Redis, and session/token revocation in PostgreSQL.

```mermaid
sequenceDiagram
  participant SessionMgr as session-manager.js
  participant FlaskAPI as Flask API
  participant FlaskAPI as Flask API
  participant Redis
  participant Postgres as PostgreSQL

  SessionMgr->>FlaskAPI: "POST /api/logout
  FlaskAPI->>FlaskAPI: {access_token, refresh_token}"
  FlaskAPI->>FlaskAPI: "paseto.parse(session_key, access_token)"
  note over FlaskAPI,Port5000: "Cleanup sequence begins"
  FlaskAPI->>Redis: "Extract session_id from claims"
  note over Redis: "Blacklist for remaining 15 min lifetime"
  FlaskAPI->>Redis: "get_token_manager().blacklist_token(access_token, ttl=900)"
  note over Redis: "Remove session from cache"
  FlaskAPI->>Postgres: "get_session_manager().delete_session(session_id)"
  note over Postgres: "Revoke all refresh tokens for session"
  FlaskAPI->>Postgres: "UPDATE RefreshToken SET is_active=false, is_revoked=true
  note over Postgres: "Deactivate session"
  FlaskAPI-->>SessionMgr: "UPDATE UserSession SET is_active=false
  SessionMgr->>SessionMgr: WHERE session_id=?"
  SessionMgr->>SessionMgr: "COMMIT transaction"
  SessionMgr->>SessionMgr: "{success: true}"
```

**Sources:** [back-end/main.py L514-L560](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L514-L560)

### Logout Cleanup Operations

| Component | Operation | Purpose | Code Reference |
| --- | --- | --- | --- |
| Client | Sends access + refresh tokens | Provide tokens for cleanup | [Session Manager](/RogueElectron/Cypher1/5.3-session-manager-module) |
| Flask | `paseto.parse(session_key, access_token)` | Extract session_id from token | [main.py L524-L531](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L524-L531) |
| Flask | `get_token_manager().blacklist_token(token, ttl=900)` | Prevent access token reuse | [main.py L536](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L536-L536) |
| Flask | `get_session_manager().delete_session(session_id)` | Remove Redis session | [main.py L539](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L539-L539) |
| Flask | `UPDATE RefreshToken SET is_active=false, is_revoked=true` | Revoke all refresh tokens | [main.py L543-L546](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L543-L546) |
| Flask | `UPDATE UserSession SET is_active=false` | Deactivate PostgreSQL session | [main.py L549-L551](https://github.com/RogueElectron/Cypher1/blob/c60431e6/main.py#L549-L551) |
| Client | Clear `localStorage` and cookies | Remove client-side tokens | [Session Manager](/RogueElectron/Cypher1/5.3-session-manager-module) |

**Sources:** [back-end/main.py L514-L560](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L514-L560)

### Logout Error Handling

The logout endpoint returns success even if cleanup operations partially fail. This design prevents logout from failing due to already-expired sessions or corrupted tokens.

```mermaid
flowchart TD

Logout["POST /api/logout"]
ParseToken["Parse access_token"]
ExtractSession["Extract session_id"]
Blacklist["Blacklist access token"]
DeleteRedis["Delete Redis session"]
RevokeTokens["Revoke refresh tokens"]
DeactivateSession["Deactivate DB session"]
Success["Return {success: true}"]
ErrorHandler["Catch exception, log warning"]

Logout --> ParseToken
ParseToken --> ExtractSession
ParseToken --> ErrorHandler
ExtractSession --> Blacklist
Blacklist --> DeleteRedis
DeleteRedis --> RevokeTokens
RevokeTokens --> DeactivateSession
DeactivateSession --> Success
ErrorHandler --> Success
```

**Sources:** [back-end/main.py L554-L558](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L554-L558)

---

## Workflow Comparison Table

| Workflow | Phases | Duration | Tokens Issued | Database Writes |
| --- | --- | --- | --- | --- |
| **Registration** | 2 (OPAQUE + TOTP) | ~2-5 minutes | None (account must login after) | `users.opaque_record`, `users.totp_secret` |
| **Login** | 4 (OPAQUE + Intermediate + TOTP + Session) | ~30-60 seconds | `pass_auth_token` (3 min), `access_token` (15 min), `refresh_token` (7 days) | `UserSession`, `RefreshToken`, `AuditLog`, `User.last_login_at` |
| **Logout** | 1 (Cleanup) | <1 second | None (tokens revoked) | `UserSession.is_active=false`, `RefreshToken.is_revoked=true` |

**Sources:** [back-end/src/register.js](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/register.js)

 [back-end/src/auth.js](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/src/auth.js)

 [back-end/main.py](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py)

 [back-end/node_internal_api/app.js](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js)

---

## Error Recovery Patterns

### Registration Timeout Recovery

If TOTP setup is not completed within 5 minutes:

* `cleanupUnverifiedAccount()` deletes the OPAQUE record from PostgreSQL
* `totpSecrets.delete(username)` removes temporary secret from memory
* User must restart registration from the beginning

**Sources:** [back-end/node_internal_api/app.js L94-L111](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/node_internal_api/app.js#L94-L111)

### Login Retry Limits

The system does not implement login attempt limits at the workflow level, but rate limiting is enforced:

* Session creation rate limit: 10 requests per minute per IP
* Rate limit enforced by `get_rate_limiter().check_rate_limit()` in Flask

**Sources:** [back-end/main.py L161-L172](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L161-L172)

### Token Expiration Handling

| Token Type | Expiration | Client Behavior | Server Behavior |
| --- | --- | --- | --- |
| `pass_auth_token` | 3 minutes | Stored in cookie, deleted after TOTP | Validated once during TOTP verification |
| `access_token` | 15 minutes | Auto-refreshed at 12 minutes via `sessionManager` | Blacklisted on logout, expires naturally |
| `refresh_token` | 7 days | One-time use, replaced on refresh | Marked `is_active=false` after use |

**Sources:** [back-end/main.py L92-L512](https://github.com/RogueElectron/Cypher1/blob/c60431e6/back-end/main.py#L92-L512)