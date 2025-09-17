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
    // wait for client to start
    try {
        await client.ready;
        console.log('OPAQUE client initialized successfully');
    } catch (error) {
        console.error('Failed to initialize OPAQUE client:', error);
        return;
    }

    const registerForm = document.getElementById('register-form'); 
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(registerForm);
            const username = formData.get('username');
            const password = formData.get('password');
            
            try {
                // start step 1 of the opaque protocol
                const { message, clientSecret } = await client.createRegistrationRequest(password);
                
                // Store the client secret
                sessionStorage.setItem('client_secret', arrayBufferToBase64(clientSecret));
                sessionStorage.setItem('username', username); // Store username 
                
                // Convert message to base64 for sending
                const messageBase64 = arrayBufferToBase64(message);
                
                // Send to server as JSON
                const response = await fetch('/api/register/start', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username,
                        message: messageBase64
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('Server response:', data);
                
                // todo - handle server response
                // using client.finalizeRegistrationRequest()
                // for now we will configure the server to just print what's sent by this to test for compatability with the python lib
                
            } catch (error) {
                console.error('Registration error:', error);
                alert(`Registration failed: ${error.message}. See console for details.`);
            }
        });
    }
});