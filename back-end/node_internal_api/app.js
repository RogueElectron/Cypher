import {   
  OpaqueClient,   
  OpaqueServer,   
  OpaqueConfig,   
  OpaqueID,  
  RegistrationRequest,  
  RegistrationResponse,  
  RegistrationRecord,  
  KE1,  
  KE2,  
  KE3,  
  CredentialFile  
} from '@cloudflare/opaque-ts';

require('dotenv').config();

const express = require('express');
const app = express();
const port = 3000; // this might be changed, i believe it's best if we set an ENV for it


class SimpleOpaqueServer {  
  constructor() {  
      this.config = new OpaqueConfig(OpaqueID.OPAQUE_P256);  
      this.users = new Map(); // DONT FORGET TO MAEK A REAL DATABASE
      this.init();  
  }  

  async init() {      
      this.oprfSeed = Buffer.from(process.env.OPRF_SEED, 'hex'); 
      this.serverKeypair = {                                  
        privateKey: process.env.AKE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        publicKey: process.env.AKE_PUBLIC_KEY.replace(/\\n/g, '\n')
      } // this is very sketchy
  }
// IMPORTANT, from here this isn't my code, it is transpiled from the typescript example implementation,
// this will undergo a lot of editing and will not work like this, this isnt finished in any way
  async register(serializedRequest, userId) {  
    const request = RegistrationRequest.deserialize(this.config, serializedRequest);  
      
    const server = new OpaqueServer(  
        this.config,  
        Array.from(this.oprfSeed),  
        {  
            private_key: Array.from(this.serverKeypair.private_key),  
            public_key: Array.from(this.serverKeypair.public_key)  
        }  
    );  
      
    const response = await server.registerInit(request, userId);  
    return response.serialize();  
}  

// Registration: store user record  
storeUser(userId, record, clientIdentity) {  
    const credentialFile = new CredentialFile(userId, record, clientIdentity);  
    this.users.set(userId, new Uint8Array(credentialFile.serialize()));  
    return true;  
}  

// Authentication: handle login request  
async login(serializedKE1, userId) {  
    const ke1 = KE1.deserialize(this.config, serializedKE1);  
      
    const userBytes = this.users.get(userId);  
    if (!userBytes) throw new Error('User not found');  
      
    const credentialFile = CredentialFile.deserialize(this.config, Array.from(userBytes));  
      
    const server = new OpaqueServer(  
        this.config,  
        Array.from(this.oprfSeed),  
        {  
            private_key: Array.from(this.serverKeypair.private_key),  
            public_key: Array.from(this.serverKeypair.public_key)  
        }  
    );  
      
    const ke2 = await server.authInit(  
        ke1,  
        credentialFile.record,  
        credentialFile.credential_identifier,  
        credentialFile.client_identity  
    );  
      
    this.authServer = server; // Store for final step  
    return ke2.serialize();  
}  

// Authentication: verify final message  
verify(serializedKE3) {  
    const ke3 = KE3.deserialize(this.config, serializedKE3);  
    const result = this.authServer.authFinish(ke3);  
    return result.session_key;  
}  
}  
// down to here


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
// to do, implement routing thru the python flask server
// start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});