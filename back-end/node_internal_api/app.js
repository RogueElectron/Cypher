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
import express from 'express'
import cors from 'cors'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'

function createKVStorage() {  // yo this KVStorage thing is just for testing, not exported 
    const storage = new Map(); // made a wrapper around map() that does what we need
    let defaultKey = null;    // prototype only - gonna use real database later 💯
      
    return {  
        store(key, value) {  
            storage.set(key, value);  
            return true;  
        },  
          
        lookup(key) {  
            const value = storage.get(key);  
            return value || false;  
        },  
          
        set_default(key, value) {  
            storage.set(key, value);  
            defaultKey = key;  
            return true;  
        },  
          
        lookup_or_default(key) {  
            if (!defaultKey) {  
                throw new Error('no default entry has been set');  
            }  
              
            const value = storage.get(key) || storage.get(defaultKey);  
            if (!value) {  
                throw new Error('no default entry has been set');  
            }  
              
            return value;  
        }  
    };  
}

const app = express()

// CORS setup - letting our frontend talk to us 
app.use(cors({
    origin: ['http://127.0.0.1:5000', 'http://localhost:5000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// OPAQUE setup - this crypto stuff is wild but it works 🔥
const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
const oprfSeed = cfg.prng.random(cfg.hash.Nh);  
const serverKeypairSeed = cfg.prng.random(cfg.constants.Nseed);
const serverAkeKeypair = await cfg.ake.deriveAuthKeyPair(serverKeypairSeed);

// our ghetto database for now lmao
const database = createKVStorage();

// TOTP secrets - this is where the magic happens ✨
const totpSecrets = new Map();

const akeKeypairExport = {  
    private_key: Array.from(serverAkeKeypair.private_key),  
    public_key: Array.from(serverAkeKeypair.public_key)  
};  
    
const server = new OpaqueServer(  
    cfg,  
    oprfSeed,  
    akeKeypairExport 
);  
    



// registration routes
app.post('/register/init', async (req, res) => {
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
        
        // Check if user already exists
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
        
        // Check if user already exists
        const existingUser = database.lookup(username);
        if (existingUser !== false) {
            return res.status(409).json({ 
                success: false, 
                error: 'Username already exists' 
            });
        }
        
        const deserRec = RegistrationRecord.deserialize(cfg, record);
        const credential_file = new CredentialFile(username, deserRec);
        const success = database.store(username, Uint8Array.from(credential_file.serialize()));
        
        if (success) {
            console.log(`User ${username} registered successfully`);
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
        
        // Store expected for this user session (better approach would be to use sessions/redis)
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
        console.log('session', finServer.session_key)
        
        // Clean up the session
        global.userSessions.delete(username);
        
        if (finServer.session_key) {
            console.log('Login successful for user:', username);
            res.status(200).json({ success: true, message: 'Login successful' });
        } else {
            console.log('Login failed:', finServer);
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
        
        // generate that TOTP secret - this is the sauce 🔥
        const secret = authenticator.generateSecret();
        
        // store it for this user - ez pz
        totpSecrets.set(username, secret);
        
        // make the URI that authenticator apps understand
        const service = 'Cypher';
        const otpauthUrl = authenticator.keyuri(username, service, secret);
        
        // turn it into a QR code - no more placeholder BS
        const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl);
        
        console.log(`TOTP setup for user ${username} - WE'RE COOKING:`, { secret, otpauthUrl });
        
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
        
        // check if their code is legit
        const isValid = authenticator.verify({ token, secret });
        
        console.log(`TOTP verification for ${username} - ${isValid ? 'VALID ✅' : 'NOPE ❌'}:`, { token });
        
        if (isValid) {
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
        const { username, token } = req.body;
        
        if (!username || !token) {
            return res.status(400).json({ error: 'Username and token are required' });
        }
        
        const secret = totpSecrets.get(username);
        if (!secret) {
            return res.status(400).json({ error: 'No TOTP secret found for user' });
        }
        
        // wiggle room for clock drift
        const isValid = authenticator.verify({ 
            token, 
            secret,
            window: 1 // +-30 seconds tolerance cause clocks be weird sometimes
        });
        
        console.log(`TOTP login check for ${username} - ${isValid ? 'LET EM IN 🚪' : 'NAH FAM ❌'}:`, { token });
        
        if (isValid) {
            res.status(200).json({ success: true, message: 'TOTP login verification successful' });
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
