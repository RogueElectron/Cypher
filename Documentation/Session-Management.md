# Session Management

> **Relevant source files**
> * [back-end/main.py](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py)
> * [back-end/src/index.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/index.js)
> * [back-end/src/session-manager.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js)
> * [back-end/static/dist/index.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/static/dist/index.js)
> * [back-end/static/dist/session-manager.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/static/dist/session-manager.js)

This document covers the session management system in Cypher, which handles user session persistence after successful authentication. The session management system is responsible for token lifecycle management, automatic token refresh, session validation, and logout procedures. This document focuses on post-authentication session handling; for authentication workflows, see [User Registration Process](/RogueElectron/Cypher/3.1-user-registration-process) and [User Login Process](/RogueElectron/Cypher/3.2-user-login-process).

## Token Types and Architecture

The Cypher session management system uses a multi-token architecture with three distinct token types, each serving a specific purpose in the authentication flow.

### Token Architecture Overview

```mermaid
flowchart TD

PassToken["pass_auth_token<br>Temporary validation"]
AccessToken["access_token<br>API access"]
RefreshToken["refresh_token<br>Token renewal"]
ActiveSessions["active_sessions<br>Dict[session_id]"]
ActiveRefreshTokens["active_refresh_tokens<br>Dict[token_id]"]
AccessCookie["access_token cookie<br>15 minute expiry"]
RefreshCookie["refresh_token cookie<br>30 day expiry"]

AccessToken --> AccessCookie
RefreshToken --> RefreshCookie
AccessToken --> ActiveSessions
RefreshToken --> ActiveRefreshTokens

subgraph subGraph2 ["Client Storage"]
    AccessCookie
    RefreshCookie
end

subgraph subGraph1 ["Flask Storage"]
    ActiveSessions
    ActiveRefreshTokens
end

subgraph subGraph0 ["Token Types"]
    PassToken
    AccessToken
    RefreshToken
    PassToken --> AccessToken
    PassToken --> RefreshToken
end
```

Sources: [back-end/main.py L36-L56](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L36-L56)

 [back-end/main.py L94-L151](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L94-L151)

 [back-end/src/session-manager.js L27-L38](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L27-L38)

### Token Specifications

| Token Type | Purpose | Expiry | Storage | Key Used |
| --- | --- | --- | --- | --- |
| `pass_auth_token` | TOTP validation bridge | 3 minutes | Server-side only | `key` |
| `access_token` | API authentication | 15 minutes | HTTP cookie | `session_key` |
| `refresh_token` | Token renewal | 30 days | HTTP cookie | `refresh_key` |

The system uses separate PASETO symmetric keys for each token type to ensure cryptographic isolation between different security contexts.

Sources: [back-end/main.py L13-L15](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L13-L15)

 [back-end/main.py L49-L54](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L49-L54)

 [back-end/main.py L112-L133](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L112-L133)

## Session Creation Process

Session creation occurs after successful OPAQUE authentication and TOTP verification. The Node.js service coordinates with the Flask service to establish a complete session.

### Session Creation Flow

```mermaid
sequenceDiagram
  participant N as Node.js API
  participant F as Flask Service
  participant AS as active_sessions
  participant AR as active_refresh_tokens
  participant S as SessionManager

  N->>F: POST /api/create-session
  note over N,F: {username: "user"}
  F->>F: Generate session_id
  F->>F: Create access_token claims
  F->>F: Create refresh_token claims
  F->>F: Generate refresh_token_id
  F->>AS: Store session metadata
  F->>AR: Store refresh token mapping
  F-->>N: Return tokens
  note over N,F: {access_token, refresh_token, expires_in: 900}
  N-->>S: Send session tokens
  S->>S: setTokens()
  S->>S: scheduleRefresh()
```

The `create_session` endpoint generates a unique `session_id` using `secrets.token_urlsafe(32)` and stores session metadata in the `active_sessions` dictionary. Each refresh token receives a unique `token_id` for revocation tracking.

Sources: [back-end/main.py L94-L151](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L94-L151)

 [back-end/src/session-manager.js L27-L38](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L27-L38)

### Session Storage Structure

The Flask service maintains two in-memory dictionaries for session tracking:

```mermaid
flowchart TD

RefreshData["token_id → {<br>username: str<br>session_id: str<br>}"]
SessionData["session_id → {<br>username: str<br>created_at: timestamp<br>last_refresh: timestamp<br>}"]

subgraph active_refresh_tokens ["active_refresh_tokens"]
    RefreshData
end

subgraph active_sessions ["active_sessions"]
    SessionData
end
```

Sources: [back-end/main.py L17-L18](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L17-L18)

 [back-end/main.py L135-L144](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L135-L144)

## Token Lifecycle Management

The `SessionManager` class handles client-side token lifecycle, including automatic refresh scheduling and token validation.

### Automatic Refresh Mechanism

The system implements proactive token refresh to prevent authentication interruptions:

```mermaid
stateDiagram-v2
    [*] --> TokensSet : "setTokens()"
    TokensSet --> RefreshScheduled : "scheduleRefresh(expiresIn - 60)"
    RefreshScheduled --> RefreshTriggered : "Timer expires"
    SessionCleared --> [*] : "Failure"
    RefreshTriggered --> ValidateResponse : "refreshTokens()"
    CheckRefreshing --> PerformRefresh : "_performRefresh()"
    PerformRefresh --> ValidateResponse : "Parse response"
    ValidateResponse --> UpdateTokens : "setTokens()"
    UpdateTokens --> [*] : "setTokens()"
```

The refresh mechanism schedules automatic renewal 60 seconds before token expiry and handles concurrent refresh attempts using the `isRefreshing` flag and `refreshPromise` to prevent race conditions.

Sources: [back-end/src/session-manager.js L61-L90](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L61-L90)

 [back-end/src/session-manager.js L92-L121](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L92-L121)

### Refresh Token Exchange

The refresh process involves a complete token exchange where the old refresh token is invalidated and new tokens are issued:

```mermaid
sequenceDiagram
  participant S as SessionManager
  participant F as Flask /api/refresh-token
  participant AR as active_refresh_tokens
  participant AS as active_sessions

  S->>F: POST refresh_token
  F->>F: Parse and validate token
  F->>AR: Verify token_id exists
  F->>AS: Verify session_id exists
  F->>AR: Delete old token_id
  F->>F: Generate new tokens
  F->>AR: Store new token_id mapping
  F->>AS: Update last_refresh timestamp
  F-->>S: Return new token pair
  S->>S: Update cookies and schedule next refresh
```

Sources: [back-end/main.py L153-L239](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L153-L239)

 [back-end/src/session-manager.js L92-L121](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L92-L121)

## Session Validation

The system provides multiple validation mechanisms for different use cases, from simple token presence checks to full server-side validation.

### Validation Methods

```mermaid
flowchart TD

HasValidSession["hasValidSession()<br>Check token presence"]
LoadTokens["loadTokens()<br>Cookie restoration"]
VerifyToken["verifyToken()<br>Server validation"]
VerifyAccess["/api/verify-access<br>Full token validation"]
SessionCheck["Session existence check<br>active_sessions"]
AuthFetch["authenticatedFetch()<br>Auto-retry with refresh"]

VerifyToken --> VerifyAccess
AuthFetch --> VerifyAccess
AuthFetch --> LoadTokens

subgraph subGraph2 ["Authenticated Requests"]
    AuthFetch
end

subgraph subGraph1 ["Server-Side Validation"]
    VerifyAccess
    SessionCheck
    VerifyAccess --> SessionCheck
end

subgraph subGraph0 ["Client-Side Validation"]
    HasValidSession
    LoadTokens
    VerifyToken
    HasValidSession --> LoadTokens
    LoadTokens --> VerifyToken
end
```

The `authenticatedFetch` method automatically handles 401 responses by attempting token refresh and retrying the request, providing transparent authentication for API calls.

Sources: [back-end/src/session-manager.js L53-L55](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L53-L55)

 [back-end/src/session-manager.js L122-L145](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L122-L145)

 [back-end/src/session-manager.js L147-L174](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L147-L174)

 [back-end/main.py L241-L281](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L241-L281)

### Token Validation Flow

The `/api/verify-access` endpoint performs comprehensive validation:

1. Parse the PASETO token using the `session_key`
2. Validate token type is `access`
3. Extract username and session_id claims
4. Verify session exists in `active_sessions`
5. Cross-check username matches session record

Sources: [back-end/main.py L241-L281](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L241-L281)

## Logout Process

The logout process ensures complete session cleanup on both client and server sides, with graceful error handling for various failure scenarios.

### Logout Sequence

```mermaid
sequenceDiagram
  participant B as logout button
  participant S as SessionManager
  participant F as Flask /api/logout
  participant AS as active_sessions
  participant AR as active_refresh_tokens
  participant C as Browser cookies

  B->>S: logout()
  S->>F: POST access_token & refresh_token
  F->>F: Parse access_token for session_id
  F->>F: Parse refresh_token for token_id
  F->>AR: Delete token_id
  F->>AS: Delete session_id
  F->>F: Find and delete related refresh tokens
  F-->>S: Success response
  S->>C: deleteCookie('access_token')
  S->>C: deleteCookie('refresh_token')
  S->>S: Clear local state
  S->>S: Cancel refresh timeout
```

The logout endpoint gracefully handles partial token availability - it attempts to extract session information from either the access token or refresh token if only one is available.

Sources: [back-end/main.py L283-L334](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L283-L334)

 [back-end/src/session-manager.js L175-L204](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L175-L204)

 [back-end/src/index.js L109-L135](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/index.js#L109-L135)

## Error Handling and Recovery

The session management system implements comprehensive error handling to maintain security while providing a smooth user experience.

### Error Scenarios and Recovery

| Error Type | Trigger | Recovery Action | User Experience |
| --- | --- | --- | --- |
| Token Expiry | Access token expires naturally | Automatic refresh | Transparent |
| Refresh Failure | Refresh token invalid/expired | Clear session, redirect to login | Login required |
| Session Revocation | Server-side session cleanup | Clear local state | Login required |
| Network Errors | Request timeouts/failures | Retry with exponential backoff | Temporary loading state |
| Invalid Claims | Malformed token structure | Clear session immediately | Login required |

### Error Handling Implementation

The `SessionManager` implements defensive programming patterns:

```javascript
// Example from session-manager.js
try {
    const response = await this._performRefresh();
    return response;
} catch (error) {
    this.clearSession(); // Always clean up on error
    throw error;
}
```

All session-related errors result in immediate session cleanup to prevent inconsistent states. The system prioritizes security by failing closed - when in doubt, it clears the session and requires re-authentication.

Sources: [back-end/src/session-manager.js L82-L121](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L82-L121)

 [back-end/src/session-manager.js L193-L204](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L193-L204)

 [back-end/main.py L91-L92](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L91-L92)

 [back-end/main.py L238-L239](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/main.py#L238-L239)