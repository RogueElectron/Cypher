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
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import createPostgresStorage from './db.js';

dotenv.config({ path: '../.env' });


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
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [] 
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: "same-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      noSniff: true,
      xssFilter: true,
      hidePoweredBy: true
    })
  );


// old in-memory storage - keeping around just in case
function createKVStorage() {
    const storage = new Map();
    return {
        store(key, value) {
            storage.set(key, value);
            return true;
        },
        lookup(key) {
            return storage.get(key) || false;
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

// Two-layer approach: rae
// 1. Redis (global) - baseline protection for all requests
// 2. express-rate-limit (specific endpoints) - stricter limits for sensitive ops

// Strict rate limiter for authentication endpoints (login/register)
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
        error: 'Too many authentication attempts. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many authentication attempts',
            retryAfter: '15 minutes'
        });
    }
});

// Moderate rate limiter for TOTP operations
const totpRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 requests per window
    message: {
        error: 'Too many TOTP verification attempts. Please try again later.',
        retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many TOTP attempts',
            retryAfter: '5 minutes'
        });
    }
});

// Aggressive rate limiter for setup operations
const setupRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour
    message: {
        error: 'Too many setup requests. Please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many setup requests',
            retryAfter: '1 hour'
        });
    }
});

// Redis-based global rate limiter (Layer 1)
const parsePositiveInt = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD ? process.env.REDIS_PASSWORD : undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2
});

redisClient.on('error', (err) => {
    console.error('Redis rate limiter error:', err);
});

const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rlf:node',
    points: parsePositiveInt(
        process.env.NODE_RATE_LIMIT_MAX_REQUESTS || process.env.RATE_LIMIT_MAX_REQUESTS,
        100
    ),
    duration: parsePositiveInt(
        process.env.NODE_RATE_LIMIT_WINDOW || process.env.RATE_LIMIT_WINDOW,
        60
    ),
    blockDuration: parsePositiveInt(process.env.NODE_RATE_LIMIT_BLOCK_DURATION, 60)
});

const rateLimitMiddleware = async (req, res, next) => {
    const keyIp = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || 'anonymous';
    const key = `${keyIp}:${req.path}`;

    try {
        await rateLimiter.consume(key);
        return next();
    } catch (err) {
        if (!err || typeof err.msBeforeNext !== 'number') {
            console.error('Rate limiter store failure, allowing request:', err);
            return next();
        }

        const retryAfterSec = Math.ceil(err.msBeforeNext / 1000) || 1;
        res.set('Retry-After', String(retryAfterSec));
        return res.status(429).json({
            error: 'Too many requests',
            retryAfter: retryAfterSec
        });
    }
};

app.use(rateLimitMiddleware);

// ===================================================

// initialize opaque cryptographic configuration  
const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  

// use stable seeds from environment - CRITICAL for production
// random seeds would change on restart and invalidate all user credentials
if (!process.env.OPRF_SEED || !process.env.SERVER_KEYPAIR_SEED) {
    throw new Error('OPRF_SEED and SERVER_KEYPAIR_SEED must be set in .env file. Run generate_secrets.sh to generate them.');
}

// Convert hex strings to Array (OPAQUE library expects regular Arrays, not Uint8Array)
const fromHex = (hexString) => hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16));

const oprfSeed = fromHex(process.env.OPRF_SEED);
const serverKeypairSeed = fromHex(process.env.SERVER_KEYPAIR_SEED);

// generate server keypair for authenticated key exchange
const serverAkeKeypair = await cfg.ake.deriveAuthKeyPair(serverKeypairSeed);

// storage for user credentials and temporary state
const database = createPostgresStorage();  // postgres for real storage
const totpSecrets = new Map();  // temp totp secrets while setting up
const unverifiedAccounts = new Map();  // accounts that need totp setup
const VERIFICATION_TIMEOUT = 5 * 60 * 1000;  // 5 min to finish setup

async function cleanupUnverifiedAccount(username) {
    const userData = await database.lookup(username);
    if (userData !== false) {
        await database.delete(username);
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

async function markAccountVerified(username) {
    if (unverifiedAccounts.has(username)) {
        clearTimeout(unverifiedAccounts.get(username));
        unverifiedAccounts.delete(username);
    }
    
    // store TOTP secret in database and enable TOTP
    const secret = totpSecrets.get(username);
    if (secret) {
        await database.storeTotpSecret(username, secret);
        await database.enableTotp(username);
        totpSecrets.delete(username);  // remove from temp storage
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
app.post('/register/init', setupRateLimiter, async (req, res) => {
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
        const existingUser = await database.lookup(username);
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

app.post('/register/finish', setupRateLimiter, async (req, res) => {
    try {
        const { record, username } = req.body;
        
        if (!record || !username) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: record and username' 
            });
        }
        
        // check if user already exists
        const existingUser = await database.lookup(username);
        if (existingUser !== false) {
            return res.status(409).json({ 
                success: false, 
                error: 'Username already exists' 
            });
        }
        
        const deserRec = RegistrationRecord.deserialize(cfg, record);
        const credential_file = new CredentialFile(username, deserRec);
        // store user credentials in database
        const success = await database.store(username, Uint8Array.from(credential_file.serialize()));
        
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

app.post('/login/init', authRateLimiter, async (req, res) => {
    try {
        const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
        const { serke1, username } = req.body;
        
        if (!serke1 || !username) {
            return res.status(400).json({ 
                error: 'Missing required fields: serke1 and username' 
            });
        }
        
        const credFileBytes = await database.lookup(username);

        if (credFileBytes === false) {
            return res.status(404).json({ 
                error: 'client not registered in database' 
            });
        }
        
        const credential_file = CredentialFile.deserialize(cfg, Array.from(credFileBytes));
        const deser_ke1 = KE1.deserialize(cfg, serke1);
        const responseke2 = await server.authInit(deser_ke1, credential_file.record, credential_file.credential_identifier);
        const { ke2, expected } = responseke2;
        
        // stash the expected value for this login attempt
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



app.post('/login/finish', authRateLimiter, async (req, res) => {
    try {
        const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
        const { serke3: ser_ke3, username } = req.body;
        
        // grab the expected value from login init
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

// totp stuff

app.post('/totp/setup', setupRateLimiter, async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }
        
        const secret = authenticator.generateSecret();
        
        totpSecrets.set(username, secret);
        
        // make the uri for google authenticator etc
        const service = 'Cypher';
        const otpauthUrl = authenticator.keyuri(username, service, secret);
        
        // turn it into a qr code
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

app.post('/totp/verify-setup', totpRateLimiter, async (req, res) => {
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
            await markAccountVerified(username);
            res.status(200).json({ success: true, message: 'TOTP verification successful' });
        } else {
            res.status(400).json({ success: false, error: 'Invalid TOTP code' });
        }
        
    } catch (error) {
        console.error('TOTP verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/totp/verify-login', totpRateLimiter, async (req, res) => {

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
        // try temp storage first (during setup), then database (after setup)
        let secret = totpSecrets.get(username);
        if (!secret) {
            secret = await database.getTotpSecret(username);
            if (!secret) {
                return res.status(400).json({ error: 'No TOTP secret found for user' });
            }
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
