import {  
    OpaqueServer,  
    OpaqueClient,    
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
// since you're back, you have a problem with the imports, and you need hte 'GetOpaqueConfig' think imported too, as well as OpaqueID 

import express from 'express'

import dotenv from 'dotenv';

dotenv.config();

const app = express()
app.use(express.json());

async function createLocalOpaqueServer() {  
    // 1. Create configuration  
    const config = new getOpaqueConfig(OpaqueID.OPAQUE_P256);  
    // 2. Generate OPRF seed  
    const oprfSeed = config.prng.random(config.hash.Nh);  
      
    // 3. Generate server AKE keypair  
    const serverKeypairSeed = config.prng.random(config.constants.Nseed);
    const serverAkeKeypair = await config.ake.deriveAuthKeyPair(serverKeypairSeed);
      
    const akeKeypairExport = {  
        private_key: Array.from(serverAkeKeypair.private_key),  
        public_key: Array.from(serverAkeKeypair.public_key)  
    };  
      
    // 4. Set server identity  
    const serverIdentity = 'Digitopia-opaque-server';  
      
    // Create your extended server  
    const server = new LocalOpaqueServer(  
        config,  
        oprfSeed,  
        akeKeypairExport,  
        serverIdentity  
    );  
      
    return server;  
}  
  

// Initialize OPAQUE server
export class LocalOpaqueServer extends OpaqueServer{
    constructor(config, oprf_seed, ake_keypair_export, server_identity) {
        super(config, oprf_seed, ake_keypair_export, server_identity);  
        
        // removed all logic here because it's already done automatically by the OpaqueServer
    }

    // register finish runs on the client side
    registerInit(request, credential_identifier) {
        return this.opaque_core.createRegistrationResponse(request, this.ake_keypair.public_key, new TextEncoder().encode(credential_identifier));
    }

    async authInit(ke1, record, credential_identifier, client_identity, context) {
        const credential_identifier_u8array = new TextEncoder().encode(credential_identifier);
        const response = await this.opaque_core.createCredentialResponse(ke1.request, record, this.ake_keypair.public_key, credential_identifier_u8array);
        const te = new TextEncoder();
        // eslint-disable-next-line no-undefined
        const client_identity_u8array = client_identity ? te.encode(client_identity) : undefined;
        const context_u8array = context ? te.encode(context) : new Uint8Array(0);
        return this.ake.response(this.ake_keypair.private_key, this.server_identity, ke1, response, context_u8array, record.client_public_key, client_identity_u8array);
    }
    
    authFinish(ke3, expected) {
        return this.ake.finish(ke3.auth_finish, expected);
    }
}

// Initialize the server properly using the createLocalOpaqueServer function
let localOpaqueServer;
createLocalOpaqueServer().then(server => {
    localOpaqueServer = server;
    console.log('OPAQUE server initialized successfully');
}).catch(error => {
    console.error('Failed to initialize OPAQUE server:', error);
});

// registration routes
app.post('/register/init', async (req, res) => {
    if (!localOpaqueServer) {
        return res.status(503).json({ error: 'Server not initialized yet' });
    }
    try {
        // The client sends { username, registrationRequest }
        // Need to convert the registrationRequest back to proper format
        const { username, registrationRequest } = req.body;
        
        // Convert the data property back to Uint8Array if it was serialized as an object
        if (registrationRequest && registrationRequest.data && typeof registrationRequest.data === 'object' && !Array.isArray(registrationRequest.data)) {
            // Convert object back to array, then to Uint8Array
            const dataArray = Object.values(registrationRequest.data);
            registrationRequest.data = new Uint8Array(dataArray);
        }
        
        let OpaqueResponse = await localOpaqueServer.registerInit(registrationRequest, username);
     
        // Convert all Uint8Arrays in the response to arrays for JSON serialization
        const serializedResponse = {
            registrationResponse: {
                evaluation: OpaqueResponse.evaluation ? Array.from(OpaqueResponse.evaluation) : null,
                server_public_key: OpaqueResponse.server_public_key ? Array.from(OpaqueResponse.server_public_key) : null
            }
        };
        
        res.status(200).json(serializedResponse);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/register/finish', async (req, res) => {
    try {
        const { username, registrationRecord } = req.body;

        // ok so this should be forwarded to the flask server along with 
        // client identity for storage and session management
        res.status(200).json({
            message: 'Registration completed successfully',
            user: username
        });

    } catch (error) {
        console.error('Registration finish error:', error);
        res.status(500).json({ error: error.message });
    }
});  

// login routes
app.get('/login/init', (req, res) => {
  
});

app.post('/login/finish', (req, res) => {
  
});

// start server
app.listen(3000, () => {
  console.log(`Server running at http://localhost:3000`);
});
