import { OpaqueClient } from 'https://esm.sh/@cloudflare/opaque-ts' /*this is where things start to get, tricky*/

// Initialize OPAQUE client
const client = new OpaqueClient('P-256-SHA256')
console.log('cdn method works') 