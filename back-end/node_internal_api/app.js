import { 
  OpaqueID, 
  OpaqueServer,
  getOpaqueConfig
} from '@cloudflare/opaque-ts';

import express from 'express'

import dotenv from 'dotenv';

dotenv.config();

const app = express()

// Helper function to convert PEM to Uint8Array
function pemToUint8Array(pem) {
    const base64 = pem
        .replace(/-----BEGIN [^-]+-----/g, '')
        .replace(/-----END [^-]+-----/g, '')
        .replace(/\s+/g, '');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Initialize OPAQUE server
async function initOpaqueServer() {
    try {
        const config = getOpaqueConfig(OpaqueID.OPAQUE_P256);
        
        // Generate OPRF seed as Uint8Array
        const oprfSeed = new Uint8Array(config.prng.random(config.hash.Nh));
        
        // Generate a key pair using the config's AKE
        const keyPair = config.ake.generateAuthKeyPair(); // insert 1000 yard stare gif
        
        // Convert keys to Uint8Array if they aren't already
        const privateKey = keyPair.privateKey instanceof Uint8Array ? 
            keyPair.privateKey : 
            new TextEncoder().encode(JSON.stringify(keyPair.privateKey));
            
        const publicKey = keyPair.publicKey instanceof Uint8Array ?
            keyPair.publicKey :
            new TextEncoder().encode(JSON.stringify(keyPair.publicKey));
        
        const server = new OpaqueServer(
            config,
            Array.from(oprfSeed),  // Convert Uint8Array to regular array
            {
                private_key: Array.from(privateKey),
                public_key: Array.from(publicKey)
            },
            'server.example.com' // Server identity
        );
        
        console.log('OPAQUE server initialized successfully');
        return server;
    } catch (error) {
        console.error('Failed to initialize OPAQUE server:', error);
        throw error;
    }
}

// Initialize the server
let server;
initOpaqueServer()
    .then(s => {
        server = s;
        // Start your Express server here once OPAQUE is ready
        // app.listen(...);
    })
    .catch(console.error);

/*
// so this converts json to js objects

app.use(express.json());


// registration routes
app.get('/register/init', (req, res) => {
 
});

app.post('/register/finish', (req, res) => {
  
});

// login routes
app.get('/login/init', (req, res) => {
  
});

app.post('/login/finish', (req, res) => {
  
});

// start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
*/