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
    const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
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
    const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
    const { ke1Base64, CredentialFileB64, username } = req.body;
    const ke1Bytes = new Uint8Array(atob(ke1Base64).split('').map(c => c.charCodeAt(0))); 
    const ke1 = KE1.deserialize(cfg, Array.from(ke1Bytes));
    console.log('second message');
    // console.log(ke1)
    // Decode from base64  
    console.log('base64 record', CredentialFileB64)
    const credentialFileBytes = new Uint8Array(atob(CredentialFileB64).split('').map(c => c.charCodeAt(0)));  
    const deserializedCredentialFile = CredentialFile.deserialize(cfg, Array.from(credentialFileBytes));  
    const registrationRecord = deserializedCredentialFile.record;  

    const authinitresult = await localOpaqueServer.authInit(ke1, registrationRecord, username);
    const ke2 = authinitresult.ke2;
    console.log('ke2', ke2)
    const ke2Serialized = ke2.serialize()
    const ke2Base64 = btoa(String.fromCharCode(...ke2Serialized))  

    console.log('ke2, we got it', ke2Base64);

    res.status(200).json({ ke2Base64 : ke2Base64 });

});

app.post('/login/finish', async (req, res) => {

    const ke3Base64 = req.body.ke3Base64;  
    const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  //declare config in scope
    const ke3Bytes = new Uint8Array(atob(ke3Base64).split('').map(c => c.charCodeAt(0)));   
    const ke3 = KE3.deserialize(cfg, Array.from(ke3Bytes));  
    try {

        let sessionKey = await localOpaqueServer.authFinish(ke3);
        return res.status(200).json('Successfully logged in')
        console.log(sessionKey, 'ladies and gentlemen, we got him');

    } catch (error) {
        return res.status(200).json('Incorrect password or username') // we need protection against user enum
    }

});

// start server
app.listen(3000, () => {
  console.log(`Server running at http://localhost:3000`);
});
