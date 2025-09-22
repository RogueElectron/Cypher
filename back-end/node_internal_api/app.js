import {    
    OpaqueServer,      
    OpaqueID,  
    getOpaqueConfig,  // Fixed: Use OpaqueConfig instead of getOpaqueConfig  
    CredentialFile,    
    RegistrationRequest,    
    RegistrationResponse,    
    RegistrationRecord,    
    KE1,    
    KE2,    
    KE3   
} from './node_modules/@cloudflare/opaque-ts/lib/src/index.js';  
import express from 'express'

import dotenv, { config } from 'dotenv';

dotenv.config();

const app = express()
app.use(express.json());

async function createLocalOpaqueServer() {  
    // 1. Create configuration  
    const cfg = new getOpaqueConfig(OpaqueID.OPAQUE_P256);  
    // 2. Generate OPRF seed  
    const oprfSeed = cfg.prng.random(cfg.hash.Nh);  
      
    // 3. Generate server AKE keypair  
    const serverKeypairSeed = cfg.prng.random(cfg.constants.Nseed);
    const serverAkeKeypair = await cfg.ake.deriveAuthKeyPair(serverKeypairSeed);
      
    const akeKeypairExport = {  
        private_key: Array.from(serverAkeKeypair.private_key),  
        public_key: Array.from(serverAkeKeypair.public_key)  
    };  
      
    // 4. Set server identity  
    const serverIdentity = 'Digitopia-opaque-server';  
    // Create your extended server  
    const server = new OpaqueServer(  
        cfg,  
        oprfSeed,  
        akeKeypairExport,  
        serverIdentity  
    );  
      
    return server;  
}  

let localOpaqueServer; 
  
createLocalOpaqueServer().then(server => {  
    localOpaqueServer = server;  
    console.log('OPAQUE server initialized');  
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
// the amount of vulnerabiliteis on this is disgusting
// although this is a demo and they barely gave us 
// enough time to make it works


// login routes
app.post('/login/init', async (req, res) => {
    // here we will recieve username, registrationrecord and ke1 from flask server
    console.log('Received request body:', JSON.stringify(req.body));
    const cfg = new getOpaqueConfig(OpaqueID.OPAQUE_P256);  
    const { ke1Base64, record, username } = req.body;
    const ke1Bytes = new Uint8Array(atob(ke1Base64).split('').map(c => c.charCodeAt(0))); 
    const ke1 = KE1.deserialize(cfg, Array.from(ke1Bytes));
    console.log('second message');
    // console.log(ke1)
    // Decode from base64  
    const recordBytes = new Uint8Array(atob(record).split('').map(c => c.charCodeAt(0)));  
    console.log('1')
    const recordArray = Array.from(recordBytes);  
    console.log('2')
    const registrationRecord = RegistrationRecord.deserialize(cfg, recordArray);  
    console.log('3')


    const ke2 = await localOpaqueServer.authInit(ke1, registrationRecord, username);
     
    console.log('ke2, we got it');
    res.status(200).json({ ke2 });

});

app.post('/login/finish', (req, res) => {

    
    let sessionKey = localOpaqueServer.authFinish(req.body.ke3, global.expected);
    console.log(sessionKey, 'ladies and gentlemen, we got him');
});

// start server
app.listen(3000, () => {
  console.log(`Server running at http://localhost:3000`);
});
