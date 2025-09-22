
import { 
  OpaqueClient,
  getOpaqueConfig,
  OpaqueID
} from '@cloudflare/opaque-ts';

//so we were basically reinventing the wheel here, extending the OpqueClient class 
// while making another one with the exact same funcitons, afer i noticed this
// i fixed it and took off about 70 lines of redundant code

// Configuration for Opaque
const config = getOpaqueConfig(OpaqueID.OPAQUE_P256);
    
document.addEventListener('DOMContentLoaded', async () => {
    // so the info sent from client is sent to the flask server, the flask forwards it to the node.js endpoint exposed by express,
    // the ts lib proccesses the requests and sends responses through the flask server which forwards it to 
    // the clients, easy, right?
    
    const registerForm = document.getElementById('register-form'); 
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const server_identity = 'Digitopia-opaque-server'; 
            const formData = new FormData(registerForm);
            const username = formData.get('username');
            const password = formData.get('password');
            const client = new OpaqueClient(config);
            const request = await client.registerInit(password);
            const response = await fetch('/api/register/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    registrationRequest: request
                })
            });
            
            if (!response.ok) {
                throw new Error('Registration failed');
            }

            const { registrationResponse } = await response.json();
            
            // Convert arrays back to Uint8Arrays for the OPAQUE library
            const reconstructedResponse = {
                evaluation: new Uint8Array(registrationResponse.evaluation),
                server_public_key: new Uint8Array(registrationResponse.server_public_key)
            };
            
            const result = await client.registerFinish(reconstructedResponse, username, server_identity);
            const record = result.record
            const serializedRecord = record.serialize();   
   
            const recordBase64 = btoa(String.fromCharCode(...serializedRecord));  

            fetch('/api/register/finish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    registrationRecord: recordBase64
                })
            });

            
        });
    }
});