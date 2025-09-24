
import { 
  OpaqueClient,
  getOpaqueConfig,
  OpaqueID,
  CredentialFile,
  RegistrationRequest,
  RegistrationResponse
} from '@cloudflare/opaque-ts';

//so we were basically reinventing the wheel here, extending the OpqueClient class 
// while making another one with the exact same funcitons, afer i noticed this
// i fixed it and took off about 70 lines of redundant code

// Configuration for Opaque
const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);
    
document.addEventListener('DOMContentLoaded', async () => {
    // so the info sent from client is sent to the flask server, the flask forwards it to the node.js endpoint exposed by express,
    // the ts lib proccesses the requests and sends responses through the flask server which forwards it to 
    // the clients, easy, right?
    
    const registerForm = document.getElementById('register-form'); 
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(registerForm);
            const username = formData.get('username');
            const password = formData.get('password');
            const client = new OpaqueClient(cfg);
            const request = await client.registerInit(password);
            const serRequest = request.serialize();
            const response = await fetch('http://localhost:3000/register/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    registrationRequest: serRequest
                })
            });
            

            const { registrationResponse } = await response.json();

            const deSerRegResponse = RegistrationResponse.deserialize(cfg, registrationResponse);

            
            const rec = await client.registerFinish(deSerRegResponse, username);
            const record = rec.record;
            const serRec = record.serialize();

            fetch('http://localhost:3000/register/finish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    record: serRec
                })
            });

            
        });
    }
});