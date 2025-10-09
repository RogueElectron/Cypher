import {
    OpaqueServer,
    OpaqueID,
    getOpaqueConfig,
    CredentialFile,
    RegistrationRequest,
    RegistrationResponse,
    RegistrationRecord,
    KE1,
    KE2,
    KE3
} from './node_modules/@cloudflare/opaque-ts/lib/src/index.js';
import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import xss from 'xss-clean';
import helmet from 'helmet';


const app = express();
app.use(xss())
app.use(
    helmet({
      hsts: false,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"], 
          styleSrc: ["'self'", "'unsafe-inline'"], 
          imgSrc: ["'self'", "data:"], 
          objectSrc: ["'none'"], 
          upgradeInsecureRequests: [] 
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: "same-origin" }, 
    })
  );


function createKVStorage() {  // Simple KV storage for testing - not for production
    const storage = new Map(); // Wrapper around Map for basic key-value operations    
      
    return {  
        store(key, value) {  
            storage.set(key, value);  
            return true;  
        },  
          
        lookup(key) {  
            const value = storage.get(key);  
            return value || false;  
        },  

        delete(key) {
            return storage.delete(key);
        },

        clear() {
            storage.clear();
            return true;
        }
          
  
    };  
}


// allow cross-origin requests from the flask frontend
app.use(cors({
    origin: ['http://127.0.0.1:5000', 'http://localhost:5000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// initialize opaque cryptographic configuration  
const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
const oprfSeed = cfg.prng.random(cfg.hash.Nh);  
const serverKeypairSeed = cfg.prng.random(cfg.constants.Nseed);
// generate server keypair for authenticated key exchange
const serverAkeKeypair = await cfg.ake.deriveAuthKeyPair(serverKeypairSeed);

// storage for user credentials and temporary state
const database = createKVStorage();
const totpSecrets = new Map();  // totp secrets during setup
const unverifiedAccounts = new Map();  // pending verification cleanup
const VERIFICATION_TIMEOUT = 5 * 60 * 1000;  // 5 minutes to complete setup

function cleanupUnverifiedAccount(username) {
    const userData = database.lookup(username);
    if (userData !== false) {
        database.delete(username);
    }
    totpSecrets.delete(username);
    unverifiedAccounts.delete(username);
}

function scheduleAccountCleanup(username) {
    const timeoutId = setTimeout(() => {
        if (unverifiedAccounts.has(username)) {
            cleanupUnverifiedAccount(username);
        }
    }, VERIFICATION_TIMEOUT);
    
    unverifiedAccounts.set(username, timeoutId);
}

function markAccountVerified(username) {
    if (unverifiedAccounts.has(username)) {
        clearTimeout(unverifiedAccounts.get(username));
        unverifiedAccounts.delete(username);
    }
}

const akeKeypairExport = {  
    private_key: Array.from(serverAkeKeypair.private_key),  
    public_key: Array.from(serverAkeKeypair.public_key)  
};  
    
const server = new OpaqueServer(  
    cfg,  
    oprfSeed,  
    akeKeypairExport 
);  
    



// user registration endpoints
app.post('/register/init', async (req, res) => {
    // make sure opaque server is ready
    if (!server) {
        return res.status(503).json({ error: 'Server not initialized yet' });
    }
    try {
        const { username, registrationRequest: serRegistrationRequest } = req.body;
        
        if (!username || !serRegistrationRequest) {
            return res.status(400).json({ 
                error: 'Missing required fields: username and registrationRequest' 
            });
        }
        
        // check if user already exists
        const existingUser = database.lookup(username);
        if (existingUser !== false) {
            return res.status(409).json({ 
                error: 'Username already exists' 
            });
        }
        
        const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
        const deSerReq = RegistrationRequest.deserialize(cfg, serRegistrationRequest);
        const regResponse = await server.registerInit(deSerReq, username);
        const serregresponse = regResponse.serialize();

        res.status(200).json({registrationResponse: serregresponse});
    } catch (error) {
        console.error('Registration init error:', error);
        res.status(500).json({ error: error.message || 'Registration initialization failed' });
    }
});

app.post('/register/finish', async (req, res) => {
    try {
        const { record, username } = req.body;
        
        if (!record || !username) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: record and username' 
            });
        }
        
        // check if user already exists
        const existingUser = database.lookup(username);
        if (existingUser !== false) {
            return res.status(409).json({ 
                success: false, 
                error: 'Username already exists' 
            });
        }
        
        const deserRec = RegistrationRecord.deserialize(cfg, record);
        const credential_file = new CredentialFile(username, deserRec);
        // store user credentials in database
        const success = database.store(username, Uint8Array.from(credential_file.serialize()));
        
        if (success) {
            console.log(`User ${username} registered successfully`);
            // user has 5 minutes to complete totp setup
            scheduleAccountCleanup(username);
            res.status(200).json({ 
                success: true, 
                message: 'Registration completed successfully' 
            });
        } else {
            throw new Error('Failed to store user credentials');
        }
    } catch (error) {
        console.error('Registration finish error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Registration completion failed' 
        });
    }
})

app.post('/login/init', async (req, res) => {
    try {
        const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
        const { serke1, username } = req.body;
        
        if (!serke1 || !username) {
            return res.status(400).json({ 
                error: 'Missing required fields: serke1 and username' 
            });
        }
        
        const credFileBytes = database.lookup(username);

        if (credFileBytes === false) {
            return res.status(404).json({ 
                error: 'client not registered in database' 
            });
        }
        
        const credential_file = CredentialFile.deserialize(cfg, Array.from(credFileBytes));
        const deser_ke1 = KE1.deserialize(cfg, serke1);
        const responseke2 = await server.authInit(deser_ke1, credential_file.record, credential_file.credential_identifier);
        const { ke2, expected } = responseke2;
        
        // Store expected for this user session (true session management comes after demo)
        global.userSessions = global.userSessions || new Map();
        global.userSessions.set(username, expected);
        const ser_ke2 = ke2.serialize();

        res.status(200).json({ ser_ke2 : ser_ke2 });
        
    } catch (error) {
        console.error('Login init error:', error);
        res.status(500).json({ 
            error: error.message || 'Login initialization failed' 
        });
    }
});



app.post('/login/finish', async (req, res) => {
    try {
        const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
        const { serke3: ser_ke3, username } = req.body;
        
        // Get the expected value for this user
        const expected = global.userSessions?.get(username);
        if (!expected) {
            return res.status(400).json({ error: 'No active session found' });
        }
        
        const deser_ke3 = KE3.deserialize(cfg, ser_ke3);
        const finServer = await server.authFinish(deser_ke3, expected);
        
        // remove opaque session state now that we're done with auth
        global.userSessions.delete(username);

        
        if (finServer.session_key) {
            // opaque auth succeeded - need intermediate token for totp phase
            try {
                const createTokenResponse = await fetch('http://localhost:5000/api/create-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username })
                });

                if (!createTokenResponse.ok) {
                    throw new Error(`Token service responded with status ${createTokenResponse.status}`);
                }

                const tokenPayload = await createTokenResponse.json();
                const passAuthToken = tokenPayload?.token;

                if (!passAuthToken) {
                    throw new Error('Token service returned an empty payload');
                }

                return res.status(200).json({
                    success: true,
                    message: 'Login successful',
                    token: passAuthToken
                });
            } catch (tokenError) {
                console.error('Token creation failed:', tokenError);
                return res.status(500).json({
                    success: false,
                    message: 'Contact server admin'
                });
            }

        } else {
            // opaque protocol failed - wrong password or user doesn't exist
            res.status(401).json({ success: false, message: 'Authentication failed' });
        }

    } catch (error) {
        console.error('Login finish error:', error);
        res.status(500).json({ error: error.message });
    }
});

// TOTP endpoints

app.post('/totp/setup', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }
        
        const secret = authenticator.generateSecret();
        
        totpSecrets.set(username, secret);
        
        // Create URI for authenticator apps
        const service = 'Cypher';
        const otpauthUrl = authenticator.keyuri(username, service, secret);
        
        // Generate QR code
        const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl);
        
        // totp secret generated and qr code created for user enrollment
        
        res.status(200).json({
            success: true,
            secret: secret,
            qrCode: qrCodeDataURL,
            otpauthUrl: otpauthUrl
        });
        
    } catch (error) {
        console.error('TOTP setup error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/totp/verify-setup', async (req, res) => {
    try {
        const { username, token } = req.body;
        
        if (!username || !token) {
            return res.status(400).json({ error: 'Username and token are required' });
        }
        
        const secret = totpSecrets.get(username);
        if (!secret) {
            return res.status(400).json({ error: 'No TOTP secret found for user' });
        }
        
        const isValid = authenticator.verify({ token, secret });
                
        if (isValid) {
            markAccountVerified(username);
            res.status(200).json({ success: true, message: 'TOTP verification successful' });
        } else {
            res.status(400).json({ success: false, error: 'Invalid TOTP code' });
        }
        
    } catch (error) {
        console.error('TOTP verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/totp/verify-login', async (req, res) => {

    try {
        const { username, token, passAuthToken } = req.body;
        
        if (!username || !token) {
            return res.status(400).json({ error: 'Username and token are required' });
        }

        if (!passAuthToken) {
            return res.status(401).json({ error: 'No authentication token found' });
        }
        
        try {
            const verifyResponse = await fetch('http://localhost:5000/api/verify-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: passAuthToken,
                    username
                })
            });

            if (!verifyResponse.ok) {
                throw new Error(`Token service responded with status ${verifyResponse.status}`);
            }

            const verifyData = await verifyResponse.json();

            if (!verifyData.valid) {
                return res.status(401).json({ error: 'Invalid or expired authentication token' });
            }
        } catch (verifyError) {
            console.error('Token verification error:', verifyError);
            return res.status(500).json({ error: 'Token verification failed' });
        }

        // intermediate token validated - now check the totp code
        const secret = totpSecrets.get(username);
        if (!secret) {
            return res.status(400).json({ error: 'No TOTP secret found for user' });
        }
        
        // verify the 6-digit totp code with 30 second window
        const isValid = authenticator.verify({ 
            token, 
            secret,
            window: 1 
        });
                
        if (isValid) {
            // totp setup complete - account is now fully verified
            markAccountVerified(username);
            
            // totp verified - create actual session tokens for the user
            try {
                const sessionResponse = await fetch('http://localhost:5000/api/create-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username
                    })
                });
                
                if (sessionResponse.ok) {
                    const sessionData = await sessionResponse.json();
                    
                    // return session tokens to client for storage
                    res.status(200).json({ 
                        success: true, 
                        message: 'TOTP login verification successful - session created',
                        access_token: sessionData.access_token,
                        refresh_token: sessionData.refresh_token,
                        expires_in: sessionData.expires_in
                    });
                } else {
                    console.error('Session creation failed');
                    res.status(200).json({ 
                        success: true, 
                        message: 'TOTP verification successful but session creation failed' 
                    });
                }
            } catch (sessionError) {
                console.error('Session creation error:', sessionError);
                res.status(200).json({ 
                    success: true, 
                    message: 'TOTP verification successful but session creation failed' 
                });
            }
        } else {
            res.status(400).json({ success: false, error: 'Invalid TOTP code' });
        }
        
    } catch (error) {
        console.error('TOTP login verification error:', error);
        res.status(500).json({ error: error.message });
    }
});


app.listen(3000, () => {
  console.log(`Server running at http://localhost:3000`);
});
