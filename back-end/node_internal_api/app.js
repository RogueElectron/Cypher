import { Serializable } from '@cloudflare/opaque-ts/lib/src/messages.js';
import { AKE3DHServer } from '@cloudflare/opaque-ts/lib/src/3dh_server.js';
import { OpaqueCoreServer } from '@cloudflare/opaque-ts/lib/src/core_server.js';

import express from 'express'

import dotenv from 'dotenv';

dotenv.config();

const app = express()

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
}
// Initialize the server

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