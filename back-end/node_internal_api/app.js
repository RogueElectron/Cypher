import { Serializable } from '@cloudflare/opaque-ts/lib/src/messages.js';
import { AKE3DHServer } from '@cloudflare/opaque-ts/lib/src/3dh_server.js';
import { OpaqueCoreServer } from '@cloudflare/opaque-ts/lib/src/core_server.js';

import express from 'express'

import dotenv from 'dotenv';

dotenv.config();

const app = express()

app.use(express.json());

// Initialize OPAQUE server
export class LocalOpaqueServer {
    constructor(config, oprf_seed, ake_keypair_export, server_identity) {
        this.config = config;
        Serializable.check_bytes_arrays([
            ake_keypair_export.public_key,
            ake_keypair_export.private_key
        ]);
        this.ake_keypair = {
            private_key: new Uint8Array(ake_keypair_export.private_key),
            public_key: new Uint8Array(ake_keypair_export.public_key)
        };
        Serializable.check_bytes_array(oprf_seed);
        this.server_identity = server_identity
            ? new TextEncoder().encode(server_identity)
            : this.ake_keypair.public_key;
        this.opaque_core = new OpaqueCoreServer(config, new Uint8Array(oprf_seed));
        this.ake = new AKE3DHServer(this.config);
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

// registration routes
app.get('/register/init', (req, res) => {
 
});

app.post('/register/finish', (req, res) => { // we porb won't need this
  
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