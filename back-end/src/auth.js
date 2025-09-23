import { 
    OpaqueClient,
    getOpaqueConfig,
    OpaqueID,
    OpaqueServer,
    KE2,
    KE3
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

            const response = await fetch('/api/login/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    ke1Base64: ke1Base64
                })
            });
            console.log('got response')
            const responseData = await response.json();  
            const ke2Base64 = responseData.ke2Base64; 
            const ke2Bytes = new Uint8Array(atob(ke2Base64).split('').map(c => c.charCodeAt(0)))  
            const ke2 = KE2.deserialize(config, Array.from(ke2Bytes))

            console.log('we got ke2')
            console.log(ke2)
            const authfinishresult = await client.authFinish(ke2)
            const ke3 = authfinishresult.ke3
            console.log('authfinishresult', authfinishresult)
            console.log('ke3 type:', typeof ke3);
            console.log('ke3:', ke3);
            const ke3Serialized = ke3.serialize(); // PROBLEM here, serialize method not recognized, investigating  
            const ke3Base64 = btoa(String.fromCharCode(...ke3Serialized))

            const result = await fetch('/api/login/finish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    ke3Base64: ke3Base64
                })
            });

            console.log(result)
            
            
        });
    }
});
