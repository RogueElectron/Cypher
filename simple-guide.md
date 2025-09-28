# Cypher Simple Guide

This is quick guide if you want to understand how cypher works and the benefits of it, without diving into too much technical details

### 1. Traditional vs OPAQUE Password Storage

```mermaid
graph TB
    subgraph "Traditional Password System"
        UserPass1["User Password: 'mypassword123'"]
        Hash1["Server Stores: hash('mypassword123')"]
        Breach1[" Database Breach"]
        Crack1["Hackers can crack offline:<br/>billions of guesses per second"]
        
        UserPass1 --> Hash1
        Hash1 --> Breach1
        Breach1 --> Crack1
    end
    
    subgraph "OPAQUE System (Cypher)"
        UserPass2["User Password: 'mypassword123'"]
        Envelope["Cryptographic Envelope<br/>(Mathematical Puzzle)"]
        ServerRecord["Server Stores: Puzzle Record<br/>(reveals nothing about password)"]
        Breach2[" Database Breach"]
        Useless["Stolen data is mathematically useless<br/>No offline cracking possible"]
        
        UserPass2 --> Envelope
        Envelope --> ServerRecord
        ServerRecord --> Breach2
        Breach2 --> Useless
    end
```

### 2. OPAQUE Registration Process

```mermaid
sequenceDiagram
    participant User as " User Device"
    participant Client as " Client (auth.js)"
    participant Server as " Server (app.js)"
    participant DB as " Database"
    
    Note over User,DB: Password NEVER leaves user device in plaintext
    
    User->>Client: "Enter password: 'mypassword123'"
    Client->>Client: "registerInit(password)<br/>Creates blinded password"
    Note over Client: Password is cryptographically blinded
    
    Client->>Server: "Blinded password + username"
    Note over Server: Server cannot see actual password
    
    Server->>Server: "Generate puzzle response"
    Server->>Client: "Puzzle response"
    
    Client->>Client: "registerFinish()<br/>Creates final record"
    Client->>Server: "Final encrypted record"
    
    Server->>DB: "Store puzzle record"
    Note over DB: Database contains mathematical puzzle<br/>NOT the password or hash
```

The registration process ensures your password never leaves your device in plaintext.

### 3. Zero-Knowledge Authentication

```mermaid
graph TB
    subgraph "Login Process - Zero Knowledge Proof"
        UserInput[" User enters password"]
        KE1["Generate KE1<br/>(Proof of knowledge)"]
        ServerChallenge[" Server sends KE2<br/>(Challenge using stored puzzle)"]
        KE3["Generate KE3<br/>(Proof response)"]
        Verified["Authentication Success<br/>Server never saw password"]
        
        UserInput --> KE1
        KE1 --> ServerChallenge
        ServerChallenge --> KE3
        KE3 --> Verified
    end
    
    subgraph "What Server Knows"
        ServerKnows["❌ NOT the password<br/>❌ NOT password hash<br/>✅ Mathematical proof user knows password"]
    end
```

The authentication steps are visualized in real-time for users.

### 4. Why Breaches Become Useless

```mermaid
graph TB
    subgraph "Hacker Steals Database"
        Stolen["Stolen OPAQUE Records"]
        Attempt1["Try to crack offline"]
        Blocked1[" IMPOSSIBLE<br/>No hash to crack"]
        
        Attempt2["Try online brute force"]
        Blocked2[" DETECTED<br/>Each guess needs live server interaction"]
        
        Attempt3["Try rainbow tables"]
        Blocked3[" USELESS<br/>No hashes exist"]
        
        Stolen --> Attempt1
        Stolen --> Attempt2  
        Stolen --> Attempt3
        Attempt1 --> Blocked1
        Attempt2 --> Blocked2
        Attempt3 --> Blocked3
    end
```

Unlike traditional password hashes, OPAQUE records stored in the database cannot be cracked offline.

### 5. Same Password, Different Sites = Different Fingerprints

```mermaid
graph TB
    subgraph "User Uses Same Password"
        SamePass["Password: 'mypassword123'"]
    end
    
    subgraph "Site A (Cypher Instance 1)"
        SiteA[" Site A"]
        FingerprintA["Cryptographic Fingerprint A<br/>(Unique mathematical puzzle)"]
        SamePass --> SiteA
        SiteA --> FingerprintA
    end
    
    subgraph "Site B (Cypher Instance 2)"
        SiteB[" Site B"]
        FingerprintB["Cryptographic Fingerprint B<br/>(Completely different puzzle)"]
        SamePass --> SiteB
        SiteB --> FingerprintB
    end
    
    subgraph "Breach Impact"
        BreachA[" Site A Breached"]
        NoImpact[" Zero information about Site B"]
        FingerprintA --> BreachA
        BreachA --> NoImpact
    end
```

Each OPAQUE server instance uses unique cryptographic seeds, ensuring different fingerprints even with identical passwords.

### 6. Complete Security Architecture

```mermaid
graph TB
    subgraph "Layer 1: OPAQUE Protocol"
        OpaqueAuth[" Zero-knowledge password proof"]
        NoPassword["Password never transmitted"]
    end
    
    subgraph "Layer 2: Two-Factor Authentication"
        TOTP[" TOTP Verification"]
        QRSetup["QR Code Setup"]
    end
    
    subgraph "Layer 3: Session Security"
        PASETO[" PASETO Tokens"]
        Rotation["Auto-rotation every 15 minutes"]
        Refresh["Refresh token mechanism"]
    end
    
    subgraph "Result"
        Impossible[" Mathematically impossible to compromise<br/>even with full database breach"]
    end
    
    OpaqueAuth --> TOTP
    TOTP --> PASETO
    PASETO --> Rotation
    Rotation --> Refresh
    Refresh --> Impossible
```

