# Frontend Components

> **Relevant source files**
> * [back-end/src/auth.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js)
> * [back-end/src/index.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/index.js)
> * [back-end/src/register.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js)
> * [back-end/src/session-manager.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js)
> * [back-end/static/dist/index.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/static/dist/index.js)
> * [back-end/static/dist/session-manager.js](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/static/dist/session-manager.js)

This document covers the client-side JavaScript architecture of the Cypher authentication system, including authentication logic, session management, live visualization components, and user interface controllers. For information about the backend services that these components interact with, see [Backend Services](/RogueElectron/Cypher/documentation/2.1-backend-services). For details about the build system and asset compilation, see [Build System and Assets](/RogueElectron/Cypher/documentation/5.1-build-system-and-assets).

## Architecture Overview

The frontend is organized into four main JavaScript modules that handle different aspects of the user experience. Each module is compiled by Vite into optimized bundles served to the browser.

```mermaid
flowchart TD

authJS["auth.js"]
registerJS["register.js"]
indexJS["index.js"]
sessionJS["session-manager.js"]
AuthLiveVisualization["AuthLiveVisualization"]
LiveVisualization["LiveVisualization"]
SessionManager["SessionManager"]
OpaqueClient["@cloudflare/opaque-ts<br>OpaqueClient"]
Bootstrap["Bootstrap UI<br>Components"]
NodeAPI["Node.js API<br>:3000"]
FlaskAPI["Flask API<br>:5000"]

authJS --> AuthLiveVisualization
registerJS --> LiveVisualization
indexJS --> SessionManager
sessionJS --> SessionManager
authJS --> OpaqueClient
registerJS --> OpaqueClient
authJS --> NodeAPI
registerJS --> NodeAPI
SessionManager --> FlaskAPI
authJS --> Bootstrap
registerJS --> Bootstrap

subgraph subGraph3 ["Backend APIs"]
    NodeAPI
    FlaskAPI
end

subgraph subGraph2 ["External Dependencies"]
    OpaqueClient
    Bootstrap
end

subgraph subGraph1 ["Core Classes"]
    AuthLiveVisualization
    LiveVisualization
    SessionManager
end

subgraph subGraph0 ["Source Modules"]
    authJS
    registerJS
    indexJS
    sessionJS
end
```

Sources: [back-end/src/auth.js L1-L475](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L1-L475)

 [back-end/src/register.js L1-L500](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L1-L500)

 [back-end/src/index.js L1-L142](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/index.js#L1-L142)

 [back-end/src/session-manager.js L1-L230](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L1-L230)

## Authentication Components

### AuthLiveVisualization Class

The `AuthLiveVisualization` class provides real-time visual feedback during the OPAQUE authentication process. It manages a predefined sequence of authentication steps and updates the UI to show progress.

```mermaid
classDiagram
    class AuthLiveVisualization {
        -steps: Array
        +init()
        +renderSteps()
        +activateStep(stepId)
        +completeStep(stepId)
        +updateSecurityStatus(message, type)
    }
    class authenticationSteps {
        +input
        +validation
        +ke1-generation
        +send-ke1
        +server-ke2
        +verify-server
        +send-ke3
        +totp-verify
        +success
    }
    AuthLiveVisualization --> authenticationSteps : uses
```

The class manages nine distinct steps in the authentication workflow [back-end/src/auth.js L19-L83](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L19-L83)

:

| Step ID | Title | Description |
| --- | --- | --- |
| `input` | Password Input | Local password entry without transmission |
| `validation` | Input Validation | Client-side credential validation |
| `ke1-generation` | Generate KE1 | OPAQUE key exchange message creation |
| `send-ke1` | Send Authentication Request | KE1 transmission to server |
| `server-ke2` | Server Response | Server KE2 message processing |
| `verify-server` | Verify Server | Server authentication and session key generation |
| `send-ke3` | Send Authentication Proof | KE3 proof transmission |
| `totp-verify` | 2FA Verification | TOTP code validation |
| `success` | Authentication Complete | Successful authentication confirmation |

Sources: [back-end/src/auth.js L86-L153](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L86-L153)

 [back-end/src/auth.js L19-L83](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L19-L83)

### OPAQUE Authentication Flow

The authentication process integrates the OPAQUE protocol through the `@cloudflare/opaque-ts` library. The flow coordinates between client-side cryptographic operations and server communication.

```mermaid
sequenceDiagram
  participant L as login-form
  participant A as auth.js
  participant O as OpaqueClient
  participant V as authLiveViz
  participant N as Node.js API (:3000)
  participant F as Flask API (:5000)

  L->>A: submit event
  A->>V: activateStep('input')
  A->>O: new OpaqueClient(cfg)
  A->>O: authInit(password)
  O-->>A: ke1
  A->>V: activateStep('send-ke1')
  A->>N: POST /login/init {username, serke1}
  N-->>A: {ser_ke2}
  A->>O: authFinish(deser_ke2)
  O-->>A: {ke3, session_key}
  A->>F: POST /api/create-token
  F-->>A: {token}
  A->>N: POST /login/finish {username, serke3}
  N-->>A: {success: true}
  A->>V: activateStep('totp-verify')
```

Sources: [back-end/src/auth.js L240-L361](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L240-L361)

 [back-end/src/auth.js L245-L247](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L245-L247)

 [back-end/src/auth.js L254-L264](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L254-L264)

### TOTP Integration

The authentication component handles Two-Factor Authentication (TOTP) verification as the final step in the login process. After successful OPAQUE authentication, users must provide a time-based code.

```mermaid
flowchart TD

totpForm["totp-verify-form"]
validateCode["Validate 6-digit code"]
getPassAuth["Get pass_auth_token from cookie"]
verifyTOTP["POST /totp/verify-login"]
processResult["Process verification result"]
storeTokens["Store session tokens via sessionManager"]
redirect["Redirect to /"]
showError["Show error alert"]

totpForm --> validateCode
validateCode --> getPassAuth
getPassAuth --> verifyTOTP
verifyTOTP --> processResult
processResult --> storeTokens
storeTokens --> redirect
validateCode --> showError
verifyTOTP --> showError
getPassAuth --> showError
```

Sources: [back-end/src/auth.js L381-L463](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L381-L463)

 [back-end/src/auth.js L415-L426](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L415-L426)

 [back-end/src/auth.js L441-L451](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L441-L451)

## Registration Components

### LiveVisualization Class

The registration process uses a separate `LiveVisualization` class that follows the same pattern as authentication but handles the registration workflow steps.

```mermaid
flowchart TD

input["input<br>Password Input"]
validation["validation<br>Input Validation"]
generateKeys["generate-keys<br>Generate Keys"]
regRequest["registration-request<br>Registration Request"]
serverResponse["server-response<br>Server Response"]
finalize["finalize<br>Finalize Registration"]
totpSetup["totp-setup<br>2FA Setup"]
totpVerify["totp-verify<br>Verify 2FA"]
success["success<br>Registration Complete"]

subgraph subGraph0 ["Registration Steps"]
    input
    validation
    generateKeys
    regRequest
    serverResponse
    finalize
    totpSetup
    totpVerify
    success
    input --> validation
    validation --> generateKeys
    generateKeys --> regRequest
    regRequest --> serverResponse
    serverResponse --> finalize
    finalize --> totpSetup
    totpSetup --> totpVerify
    totpVerify --> success
end
```

The registration workflow includes OPAQUE protocol registration and mandatory TOTP setup [back-end/src/register.js L12-L76](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L12-L76)

Sources: [back-end/src/register.js L79-L146](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L79-L146)

 [back-end/src/register.js L12-L76](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L12-L76)

### OPAQUE Registration Integration

Registration uses the `OpaqueClient.registerInit()` and `OpaqueClient.registerFinish()` methods to implement the OPAQUE registration protocol.

```mermaid
sequenceDiagram
  participant R as register-form
  participant J as register.js
  participant O as OpaqueClient
  participant V as liveViz
  participant N as Node.js API (:3000)

  R->>J: submit event
  J->>V: activateStep('generate-keys')
  J->>O: registerInit(password)
  O-->>J: request
  J->>N: POST /register/init {username, registrationRequest}
  N-->>J: {registrationResponse}
  J->>O: registerFinish(deSerRegResponse)
  O-->>J: {record}
  J->>N: POST /register/finish {username, record}
  N-->>J: {success: true}
  J->>V: activateStep('totp-setup')
```

Sources: [back-end/src/register.js L260-L345](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L260-L345)

 [back-end/src/register.js L265-L267](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L265-L267)

 [back-end/src/register.js L274-L283](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L274-L283)

### TOTP Setup Components

After successful OPAQUE registration, the system automatically initiates TOTP setup through the `generateTotpSecret()` function, which communicates with the Node.js API to create QR codes and secrets.

```mermaid
flowchart TD

generateTotpSecret["generateTotpSecret()"]
setupRequest["POST /totp/setup"]
displayQR["displayServerQrCode()"]
showInfo["showTotpInfo()"]
qrContainer["qr-code container"]
totpForm["totp-verify-form"]
verifySetup["POST /totp/verify-setup"]
redirect["Redirect to /api/login"]

generateTotpSecret --> setupRequest
setupRequest --> displayQR
setupRequest --> showInfo
displayQR --> qrContainer
totpForm --> verifySetup
verifySetup --> redirect
```

Sources: [back-end/src/register.js L357-L390](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L357-L390)

 [back-end/src/register.js L392-L408](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L392-L408)

 [back-end/src/register.js L416-L485](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L416-L485)

## Session Management Component

### SessionManager Class

The `SessionManager` class handles the complete lifecycle of authentication tokens, including storage, refresh, and validation. It provides a centralized interface for managing user sessions across the application.

```mermaid
classDiagram
    class SessionManager {
        -accessToken: string
        -refreshToken: string
        -refreshTimeout: number
        -isRefreshing: boolean
        -refreshPromise: Promise
        +setCookie(name, value, maxAge)
        +getCookie(name) : : string
        +deleteCookie(name)
        +setTokens(accessToken, refreshToken, expiresIn)
        +loadTokens() : : boolean
        +hasValidSession() : : boolean
        +getAccessToken() : : string
        +scheduleRefresh(seconds)
        +refreshTokens() : : Promise
        +verifyToken() : : Promise
        +authenticatedFetch(url, options) : : Promise
        +logout() : : Promise
        +clearSession()
        +getCurrentUser() : : Promise
    }
    class FlaskAPI {
    }
    SessionManager --> FlaskAPI : interacts with
```

Sources: [back-end/src/session-manager.js L1-L221](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L1-L221)

### Token Lifecycle Management

The `SessionManager` implements automatic token refresh functionality that schedules refresh operations before token expiry and handles concurrent refresh attempts.

```mermaid
stateDiagram-v2
    [*] --> NoTokens : "logout()"
    ScheduledRefresh --> AutoRefresh : "1 minute before expiry"
    AutoRefresh --> ScheduledRefresh : "new tokens received"
    ScheduledRefresh --> WaitExisting : "isRefreshing = true"
    ScheduledRefresh --> PerformRefresh : "new tokens received"
    WaitExisting --> [*] : "return existing promise"
    PerformRefresh --> APICall : "POST /api/refresh-token"
    APICall --> [*] : "update tokens or clear session"
```

Sources: [back-end/src/session-manager.js L27-L38](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L27-L38)

 [back-end/src/session-manager.js L61-L69](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L61-L69)

 [back-end/src/session-manager.js L71-L121](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L71-L121)

### Authenticated Request Handling

The `authenticatedFetch()` method provides automatic token refresh for API requests that return 401 responses, ensuring seamless user experience.

```mermaid
flowchart TD

authFetch["authenticatedFetch(url, options)"]
checkToken["Check accessToken exists"]
addAuth["Add Authorization header"]
makeRequest["fetch(url, authOptions)"]
check401["Response status = 401?"]
returnResp["Return response"]
refreshTokens["refreshTokens()"]
updateAuth["Update Authorization header"]
retryRequest["fetch(url, authOptions)"]
throwError["Throw 'No access token' error"]

authFetch --> checkToken
checkToken --> addAuth
addAuth --> makeRequest
makeRequest --> check401
check401 --> returnResp
check401 --> refreshTokens
refreshTokens --> updateAuth
updateAuth --> retryRequest
retryRequest --> returnResp
checkToken --> throwError
refreshTokens --> throwError
```

Sources: [back-end/src/session-manager.js L147-L174](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L147-L174)

## Home Page Component

### Dynamic UI Rendering

The `index.js` module manages the home page experience by checking authentication state and dynamically rendering appropriate content using the `SessionManager`.

```mermaid
flowchart TD

DOMContentLoaded["DOMContentLoaded event"]
loadTokens["sessionManager.loadTokens()"]
hasSession["Has valid session?"]
getCurrentUser["sessionManager.getCurrentUser()"]
showUnauthenticated["showUnauthenticatedView()"]
userExists["User data exists?"]
showAuthenticated["showAuthenticatedView(username)"]
addLogoutHandler["Add logout button handler"]

DOMContentLoaded --> loadTokens
loadTokens --> hasSession
hasSession --> getCurrentUser
hasSession --> showUnauthenticated
getCurrentUser --> userExists
userExists --> showAuthenticated
userExists --> showUnauthenticated
showAuthenticated --> addLogoutHandler
getCurrentUser --> showUnauthenticated
```

Sources: [back-end/src/index.js L3-L24](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/index.js#L3-L24)

 [back-end/src/index.js L26-L80](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/index.js#L26-L80)

 [back-end/src/index.js L82-L107](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/index.js#L82-L107)

### Logout Handling

The logout functionality integrates with the `SessionManager.logout()` method and provides visual feedback during the logout process.

```mermaid
sequenceDiagram
  participant B as logout-btn
  participant H as handleLogout()
  participant S as sessionManager
  participant F as Flask API (:5000)

  B->>H: click event
  H->>H: Disable button, show spinner
  H->>S: logout()
  S->>F: POST /api/logout
  F-->>S: logout response
  S->>S: clearSession()
  S-->>H: logout complete
  H->>H: Update button text
  H->>H: Reload page after 1s
```

Sources: [back-end/src/index.js L109-L135](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/index.js#L109-L135)

 [back-end/src/session-manager.js L175-L191](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/session-manager.js#L175-L191)

## Utility Functions and UI Helpers

### Alert System

Both authentication and registration modules share common UI feedback patterns through utility functions that manage Bootstrap alert components.

```mermaid
flowchart TD

showAlert["showAlert(message, type, containerId)"]
createAlert["Create Bootstrap alert HTML"]
insertAlert["Insert into alert container"]
autoDissmiss["Auto-dismiss after 5s for success"]
clearAlerts["clearAlerts()"]
clearDefault["Clear alert-container"]
clearTOTP["Clear totp-alert-container"]

showAlert --> createAlert
createAlert --> insertAlert
insertAlert --> autoDissmiss
clearAlerts --> clearDefault
clearAlerts --> clearTOTP
```

The `showAlert()` function accepts parameters for message content, alert type (`success` or `error`), and target container ID [back-end/src/auth.js L175-L198](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L175-L198)

 and [back-end/src/register.js L171-L197](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L171-L197)

Sources: [back-end/src/auth.js L175-L198](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L175-L198)

 [back-end/src/register.js L171-L197](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L171-L197)

 [back-end/src/auth.js L200-L203](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L200-L203)

 [back-end/src/register.js L199-L208](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L199-L208)

### Input Validation and Formatting

Form inputs include client-side validation and formatting, particularly for TOTP codes which are restricted to 6-digit numeric input.

```mermaid
flowchart TD

totpInput["totp-code input"]
inputEvent["input event listener"]
removeNonDigits["Remove non-numeric characters"]
limitLength["Limit to 6 digits maximum"]
updateValue["Update input.value"]

totpInput --> inputEvent
inputEvent --> removeNonDigits
removeNonDigits --> limitLength
limitLength --> updateValue
```

Sources: [back-end/src/auth.js L465-L473](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/auth.js#L465-L473)

 [back-end/src/register.js L488-L499](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/src/register.js#L488-L499)

## Build System Integration

The frontend components are processed by Vite and compiled into optimized bundles in the `back-end/static/dist/` directory. The compiled files maintain the same module structure but with minified code and optimized imports.

| Source Module | Compiled Output | Purpose |
| --- | --- | --- |
| `src/auth.js` | Not directly compiled | Loaded by HTML templates |
| `src/register.js` | Not directly compiled | Loaded by HTML templates |
| `src/index.js` | `dist/index.js` | Home page functionality |
| `src/session-manager.js` | `dist/session-manager.js` | Session management |

Sources: [back-end/static/dist/index.js L1-L74](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/static/dist/index.js#L1-L74)

 [back-end/static/dist/session-manager.js L1-L2](https://github.com/RogueElectron/Cypher/blob/7b7a1583/back-end/static/dist/session-manager.js#L1-L2)