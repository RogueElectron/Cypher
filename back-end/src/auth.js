import { 
    OpaqueClient,
    getOpaqueConfig,
    OpaqueID,
    OpaqueServer,
    KE2,
    KE3
  } from '@cloudflare/opaque-ts';

const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(loginForm);
            const username = formData.get('username');
            const password = formData.get('password'); 
            const client = new OpaqueClient(cfg);
            const ke1 = await client.authInit(password);
            const ser_ke1 = ke1.serialize();

            const response = await fetch('http://localhost:3000/login/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    serke1: ser_ke1
                })
            });

            const responseData = await response.json();  
            const ser_ke2 = responseData.ser_ke2;
            const deser_ke2 = KE2.deserialize(cfg, ser_ke2);
            const finClient = await client.authFinish(deser_ke2);
            console.log(finClient)
            const ke3 = finClient.ke3;
            console.log(ke3)
            const ser_ke3 = ke3.serialize();
            console.log(ser_ke3)

            const result = await fetch('http://localhost:3000/login/finish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    serke3: ser_ke3
                })
            });            
            
        });
    }
});
