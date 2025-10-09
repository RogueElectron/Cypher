# OPAQUE Protocol Documentation for Beginners

## What is OPAQUE?

OPAQUE is a secure password authentication protocol that allows users to authenticate with a server without the server ever knowing their actual password. This makes it much more secure than traditional password systems.

## Overview

The OPAQUE protocol has two main components:
- **OpaqueClient**: Runs on the user's device (browser, mobile app, etc.)
- **OpaqueServer**: Runs on the server

The protocol works in two phases:
1. **Registration**: When a user creates an account
2. **Authentication**: When a user logs in

---

# OpaqueServer Class

The server-side component that handles user registration and authentication.

## Constructor

### `new OpaqueServer(config, oprf_seed, ake_keypair_export, server_identity)`

Creates a new server instance.

**Parameters:**
- `config` (Object): Configuration settings for the OPAQUE protocol
- `oprf_seed` (Uint8Array or Array): A random seed used for cryptographic operations
  - **What it is**: Think of this as a secret random number that helps generate other keys
  - **Type**: Array of numbers (0-255) or Uint8Array
  - **Example**: `[123, 45, 67, 89, ...]` or `new Uint8Array([123, 45, 67, 89, ...])`
- `ake_keypair_export` (Object): The server's public/private key pair
  - **Structure**: `{ public_key: Array/Uint8Array, private_key: Array/Uint8Array }`
  - **What it is**: Like the server's ID card - public key is shown to everyone, private key is kept secret
- `server_identity` (String, optional): A name/identifier for the server
  - **What it is**: A human-readable name for your server (like "MyApp Server")
  - **Type**: Regular text string
  - **Example**: `"My Gaming Server"`

**Example:**
```javascript
const server = new OpaqueServer(
  config,                           // Your config object
  new Uint8Array([1, 2, 3, 4, 5]), // Random seed
  {
    public_key: new Uint8Array([...]),  // Server's public key
    private_key: new Uint8Array([...])  // Server's private key
  },
  "My Server"                       // Optional server name
);
```

## Registration Methods

### `registerInit(request, credential_identifier)`

**What it does**: Handles the first step when a user wants to create an account.

**Parameters:**
- `request` (Uint8Array): The registration request from the client
  - **What it is**: Encrypted data sent by the user's device
  - **Where it comes from**: You get this from the client's `registerInit()` method
- `credential_identifier` (String): A unique identifier for this user
  - **What it is**: Usually the username or email address
  - **Type**: Regular text string
  - **Example**: `"john@example.com"` or `"john_doe"`

**Returns**: A response object to send back to the client

**Example:**
```javascript
// Client sends you a registration request
const clientRequest = /* received from client */;
const username = "john@example.com";

const response = server.registerInit(clientRequest, username);
// Send 'response' back to the client
```

## Authentication Methods

### `authInit(ke1, record, credential_identifier, client_identity, context)`

**What it does**: Handles the first step when a user wants to log in.

**Parameters:**
- `ke1` (Object): The authentication request from the client
  - **What it is**: Contains the user's login attempt data
  - **Where it comes from**: You get this from the client's `authInit()` method
- `record` (Object): The user's stored registration data
  - **What it is**: The data you saved when the user registered
  - **Where it comes from**: Your database/storage from the registration process
- `credential_identifier` (String): The user's identifier
  - **What it is**: Usually the username or email they're trying to log in with
  - **Example**: `"john@example.com"`
- `client_identity` (String, optional): Additional client identification
  - **What it is**: Extra info about the client (often the same as credential_identifier)
  - **Can be**: `null`, `undefined`, or a string
- `context` (String, optional): Additional context information
  - **What it is**: Extra data for this specific login attempt
  - **Can be**: `null`, `undefined`, or a string

**Returns**: A Promise that resolves to a response object

**Example:**
```javascript
// User is trying to log in
const loginRequest = /* received from client */;
const userRecord = /* get from your database */;
const username = "john@example.com";

const response = await server.authInit(
  loginRequest,     // From client
  userRecord,       // From your database
  username,         // Who's logging in
  username,         // Optional: same as username usually
  null              // Optional: extra context
);
// Send 'response' back to the client
```

### `authFinish(ke3, expected)`

**What it does**: Completes the authentication process.

**Parameters:**
- `ke3` (Object): The final authentication message from the client
  - **What it is**: The client's proof that they know the correct password
  - **Where it comes from**: You get this from the client's `authFinish()` method
- `expected` (Object): What you expect the client to prove
  - **What it is**: Data from the previous `authInit()` step
  - **Where it comes from**: The response from your `authInit()` call

**Returns**: Boolean - `true` if authentication succeeded, `false` if it failed

**Example:**
```javascript
// Client sends final authentication proof
const finalProof = /* received from client */;
const expectedData = /* from your authInit response */;

const success = server.authFinish(finalProof, expectedData);
if (success) {
  // User is authenticated! Log them in.
} else {
  // Authentication failed. Reject the login.
}
```

---

# OpaqueClient Class

The client-side component that runs in the user's browser or app.

## Constructor

### `new OpaqueClient(config, memHard)`

Creates a new client instance.

**Parameters:**
- `config` (Object): Configuration settings (same as server)
- `memHard` (Function, optional): Memory-hard function for password processing
  - **What it is**: A special function that makes password cracking harder
  - **Default**: Uses ScryptMemHardFn (you usually don't need to change this)

**Example:**
```javascript
const client = new OpaqueClient(config);
```

## Registration Methods

### `registerInit(password)`

**What it does**: Starts the account creation process.

**Parameters:**
- `password` (String): The user's chosen password
  - **What it is**: The actual password the user wants to use
  - **Type**: Regular text string
  - **Example**: `"mySecurePassword123!"`

**Returns**: Promise that resolves to either:
- A request object (to send to server) if successful
- An Error object if something went wrong

**Example:**
```javascript
const password = "mySecurePassword123!";
const request = await client.registerInit(password);

if (request instanceof Error) {
  // Something went wrong
  console.log("Error:", request.message);
} else {
  // Send 'request' to your server's registerInit method
}
```

### `registerFinish(response, server_identity, client_identity)`

**What it does**: Completes the account creation process.

**Parameters:**
- `response` (Object): The response from the server's `registerInit`
  - **Where it comes from**: You get this back from your server
- `server_identity` (String, optional): The server's identifier
  - **What it is**: The name/ID of the server (should match what server uses)
  - **Example**: `"My Server"`
- `client_identity` (String, optional): The client's identifier
  - **What it is**: Usually the username or email
  - **Example**: `"john@example.com"`

**Returns**: Promise that resolves to either:
- Registration record (save this!) if successful
- An Error object if something went wrong

**Example:**
```javascript
const serverResponse = /* received from server */;
const username = "john@example.com";

const record = await client.registerFinish(
  serverResponse,
  "My Server",    // Optional: server name
  username        // Optional: username
);

if (record instanceof Error) {
  // Registration failed
  console.log("Registration error:", record.message);
} else {
  // Success! Save 'record' to your server's database
  // This record will be needed for future logins
}
```

## Authentication Methods

### `authInit(password)`

**What it does**: Starts the login process.

**Parameters:**
- `password` (String): The password the user entered
  - **What it is**: What the user typed in the password field
  - **Type**: Regular text string

**Returns**: Promise that resolves to either:
- A KE1 object (to send to server) if successful
- An Error object if something went wrong

**Example:**
```javascript
const password = "mySecurePassword123!";
const loginRequest = await client.authInit(password);

if (loginRequest instanceof Error) {
  // Something went wrong
  console.log("Error:", loginRequest.message);
} else {
  // Send 'loginRequest' to your server's authInit method
}
```

### `authFinish(ke2, server_identity, client_identity, context)`

**What it does**: Completes the login process.

**Parameters:**
- `ke2` (Object): The response from the server's `authInit`
  - **Where it comes from**: You get this back from your server
- `server_identity` (String, optional): The server's identifier
- `client_identity` (String, optional): The client's identifier  
- `context` (String, optional): Additional context information

**Returns**: Promise that resolves to either:
- Success object with `{ ke3, session_key, export_key }` if login succeeded
- An Error object if login failed

**Example:**
```javascript
const serverResponse = /* received from server */;
const username = "john@example.com";

const result = await client.authFinish(
  serverResponse,
  "My Server",    // Optional: server name
  username,       // Optional: username
  null            // Optional: context
);

if (result instanceof Error) {
  // Login failed
  console.log("Login error:", result.message);
} else {
  // Login succeeded!
  const { ke3, session_key, export_key } = result;
  
  // Send 'ke3' to server's authFinish method for final verification
  // Use 'session_key' for encrypting communication
  // 'export_key' can be used for other cryptographic purposes
}
```

---

# Complete Flow Examples

## Registration Flow

**Client Side:**
```javascript
// 1. User wants to create account
const client = new OpaqueClient(config);
const password = "userPassword123!";

// 2. Start registration
const request = await client.registerInit(password);
// Send 'request' to server

// 4. Finish registration with server response
const record = await client.registerFinish(serverResponse, "My Server", "john@example.com");
// Send 'record' to server to store in database
```

**Server Side:**
```javascript
// 3. Handle registration request
const response = server.registerInit(clientRequest, "john@example.com");
// Send 'response' back to client

// 5. Store the registration record
// Save 'record' in your database for this user
```

## Login Flow

**Client Side:**
```javascript
// 1. User wants to log in
const client = new OpaqueClient(config);
const password = "userPassword123!";

// 2. Start login
const ke1 = await client.authInit(password);
// Send 'ke1' to server

// 4. Finish login
const result = await client.authFinish(serverResponse, "My Server", "john@example.com");
if (result instanceof Error) {
  // Login failed
} else {
  const { ke3, session_key } = result;
  // Send 'ke3' to server for final check
  // Use session_key for secure communication
}
```

**Server Side:**
```javascript
// 3. Handle login attempt
const userRecord = /* get from database for this user */;
const ke2 = await server.authInit(clientKe1, userRecord, "john@example.com");
// Send 'ke2' back to client

// 5. Final verification
const success = server.authFinish(clientKe3, expectedData);
if (success) {
  // User is logged in!
} else {
  // Login failed
}
```

---

# Data Types Quick Reference

- **String**: Regular text like `"hello world"`
- **Uint8Array**: Array of bytes like `new Uint8Array([1, 2, 3, 4])`
- **Array**: Regular JavaScript array like `[1, 2, 3, 4]`
- **Object**: JavaScript object like `{ key: "value" }`
- **Promise**: Asynchronous operation (use `await` with these)
- **Error**: When something goes wrong, check with `instanceof Error`

Remember: Always use `await` with methods that return Promises!