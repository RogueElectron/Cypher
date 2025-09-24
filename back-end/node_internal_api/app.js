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

function createKVStorage() {  // the KVStorage is kept as a test utility and not exported at 
    const storage = new Map(); // transpilation, i've made a wrapper around map() that mirrors it's behaviour
    let defaultKey = null;    // this is only for the prototype, in the final version there will be a real database
      
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

// Enable CORS for all routes
app.use(cors({
    origin: ['http://127.0.0.1:5000', 'http://localhost:5000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
const oprfSeed = cfg.prng.random(cfg.hash.Nh);  
const serverKeypairSeed = cfg.prng.random(cfg.constants.Nseed);
const serverAkeKeypair = await cfg.ake.deriveAuthKeyPair(serverKeypairSeed);

// Initialize database
const database = createKVStorage();

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
        const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
        const deSerReq = RegistrationRequest.deserialize(cfg, serRegistrationRequest)
        const regResponse = await server.registerInit(deSerReq, username)
        const serregresponse = regResponse.serialize()

        res.status(200).json({registrationResponse: serregresponse})
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/register/finish', async (req, res) => {
    const { record, username } = req.body;
    const deserRec = RegistrationRecord.deserialize(cfg, record);
    const credential_file = new CredentialFile(username, deserRec);
    const success = database.store(username, Uint8Array.from(credential_file.serialize()));
    res.status(200).json({success: success})
})

app.post('/login/init', async (req, res) => {

    const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
    const { serke1, username } = req.body;
    const credFileBytes = database.lookup(username);

    if (credFileBytes === false) {
        throw new Error('client not registered in database');
    }
    const credential_file = CredentialFile.deserialize(cfg, Array.from(credFileBytes));

    const deser_ke1 = KE1.deserialize(cfg, serke1);
    const responseke2 = await server.authInit(deser_ke1, credential_file.record, credential_file.credential_identifier);
    const ke2 = responseke2.ke2
    const ser_ke2 = ke2.serialize();


    res.status(200).json({ ser_ke2 : ser_ke2 });

});



app.post('/login/finish', async (req, res) => {
    const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);  
    const { serke3: ser_ke3, username } = req.body;
    const deser_ke3 = KE3.deserialize(cfg, ser_ke3);
    const finServer = server.authFinish(deser_ke3);
    // At the end, server and client MUST arrive to the same session key.
    const { session_key: session_key_server } = finServer;
});


app.listen(3000, () => {
  console.log(`Server running at http://localhost:3000`);
});
