import { OpaqueClient } from 'https://esm.sh/@cloudflare/opaque-ts' /*this is where things start to get, tricky*/

function arrayBufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64) { 
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/* start the opaque client */
const client = new OpaqueClient({
    group: 'P-256',  // i don't think we have to do this config with the python lib
    hash: 'SHA-256', // SHA-256 hashing
    oprf: { hash: 'SHA-256' } // OPRF config
});

document.addEventListener('DOMContentLoaded', async () => {
    // so this is sent to the flask server, the flask forwards it to the node.js endpoint exposed by express,
    // the ts lib proccesses the requests and sends responses through the flask server which forwards it to 
    // the clients, easy, right?
    const registerForm = document.getElementById('register-form'); 
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(registerForm);
            const username = formData.get('username');
            const password = formData.get('password');
            
        });
    }
});