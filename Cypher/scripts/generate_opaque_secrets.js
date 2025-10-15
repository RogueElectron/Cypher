import {
    OpaqueID,
    getOpaqueConfig
} from './node_internal_api/node_modules/@cloudflare/opaque-ts/lib/src/index.js';

// Generate OPAQUE cryptographic secrets properly using the library
async function generateOpaqueSecrets() {
    try {
        // Initialize opaque cryptographic configuration
        const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);
        
        // Generate OPRF seed with correct size for the hash function
        const oprfSeed = cfg.prng.random(cfg.hash.Nh);
        
        // Generate server keypair seed with correct size
        const serverKeypairSeed = cfg.prng.random(cfg.constants.Nseed);
        
        // Derive the actual server keypair for authenticated key exchange
        const serverAkeKeypair = await cfg.ake.deriveAuthKeyPair(serverKeypairSeed);
        
        // Convert to hex for storage in .env
        const toHex = (uint8Array) => Array.from(uint8Array).map(b => b.toString(16).padStart(2, '0')).join('');
        
        const secrets = {
            OPRF_SEED: toHex(oprfSeed),
            SERVER_KEYPAIR_SEED: toHex(serverKeypairSeed),
            SERVER_PRIVATE_KEY: toHex(serverAkeKeypair.private_key),
            SERVER_PUBLIC_KEY: toHex(serverAkeKeypair.public_key)
        };
        
        // Output as JSON for easy parsing
        console.log(JSON.stringify(secrets));
    } catch (error) {
        console.error('Error generating OPAQUE secrets:', error);
        process.exit(1);
    }
}

generateOpaqueSecrets();
