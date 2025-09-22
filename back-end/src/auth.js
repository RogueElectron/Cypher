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
            const ke1 = await client.authInit(password);  
            const ke1Serialized = ke1.serialize();  
            const ke1Base64 = btoa(String.fromCharCode(...ke1Serialized))
            console.log(ke1);
            
            fetch('/api/login/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    ke1Base64: ke1Base64
                })
            });
            
            
        });
    }
});
