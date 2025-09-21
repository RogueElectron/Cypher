import { 
    OpaqueClient,
    getOpaqueConfig,
    OpaqueID
  } from '@cloudflare/opaque-ts';

const config = getOpaqueConfig(OpaqueID.OPAQUE_P256);
const serverIdentity = 'Digitopia-opaque-server';

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(loginForm);
            const username = formData.get('username');
            const password = formData.get('password');
            const client = new OpaqueClient(config);
            const ke1 = await client.authInit(password); // this function returns ke1 
            const response = await fetch('/api/login/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ke1: ke1,
                    username: username, // if have enough time, make sure there's a 
                                        // consistent request format to all api endpoints 
                }),
            });
            // this returns ke2, the client must proccess it and arrive to the same 
            // result as the server
            const ke2 = await response.json();
            //auth finish takes these [ke2, server_identity, client_identity]
            // and returns ke3, session_key, export_key
            // ke3 is sent to the server
            // if the password is correct the client and server
            // will arrive to the same session key
            const authFinishResponse = await client.authFinish(ke2, serverIdentity, username);
            
            
    }
});
