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

class LocalOpaqueServer {    
  constructor() {  
      this.config = new OpaqueConfig(OpaqueID.OPAQUE_P256);  
      this.users = new Map(); // DONT FORGET TO MAEK A REAL DATABASE
      this.init();  
  }  

  async init() {      
      this.oprfSeed = new Uint8Array(Buffer.from(process.env.OPRF_SEED, 'hex'));

      this.serverKeypair = {                                  
        private_key: process.env.AKE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        public_key: process.env.AKE_PUBLIC_KEY.replace(/\\n/g, '\n')
      } // this is very sketchy

      this.server = new OpaqueServer(  
        this.config,  
        Array.from(this.oprfSeed),  
        {  
            private_key: Array.from(this.serverKeypair.private_key),  
            public_key: Array.from(this.serverKeypair.public_key)  
        }  
    );
  }
       // IMPORTANT, this is the code transpiled from the example implementationn
     // Registration: handle client request  
     // uhhh this has multiple problems in serilization and deserialization, fixing tomorrow, hopefully
     async register(serializedRequest, userId) {  
      const request = RegistrationRequest.deserialize(this.config, serializedRequest);  
      const response = await this.server.registerInit(request, userId);  
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
        
      const ke2 = await this.server.authInit(  
          ke1,  
          credentialFile.record,  
          credentialFile.credential_identifier,  
          credentialFile.client_identity  
      );  
        
      return ke2.serialize();  
  }  

  // Authentication: verify final message  
  verify(serializedKE3) {  
      const ke3 = KE3.deserialize(this.config, serializedKE3);  
      const result = this.server.authFinish(ke3);  
      return result.session_key;  
  }  
}  

export { LocalOpaqueServer };


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