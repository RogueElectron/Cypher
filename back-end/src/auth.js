
import { 
  OpaqueClient as CoreOpaqueClient,
  ScryptMemHardFn,
  getOpaqueConfig,
  OpaqueID
} from '@cloudflare/opaque-ts';

export class OpaqueClient extends CoreOpaqueClient {
    constructor(config, memHard = ScryptMemHardFn) {
        super(config, memHard);
        this.status = OpaqueClient.States.NEW;
    }
    async registerInit(password) {
        if (this.status !== OpaqueClient.States.NEW) {
            return new Error('client not ready');
        }
        const password_uint8array = new TextEncoder().encode(password);
        const { request, blind } = await this.opaque_core.createRegistrationRequest(password_uint8array);
        this.blind = blind;
        this.password = password_uint8array;
        this.status = OpaqueClient.States.REG_STARTED;
        return request;
    }
    async registerFinish(response, server_identity, client_identity) {
        if (this.status !== OpaqueClient.States.REG_STARTED ||
            typeof this.password === 'undefined' ||
            typeof this.blind === 'undefined') {
            return new Error('client not ready');
        }
        const te = new TextEncoder();
        // eslint-disable-next-line no-undefined
        const server_identity_u8array = server_identity ? te.encode(server_identity) : undefined;
        // eslint-disable-next-line no-undefined
        const client_identity_u8array = client_identity ? te.encode(client_identity) : undefined;
        const out = await this.opaque_core.finalizeRequest(this.password, this.blind, response, server_identity_u8array, client_identity_u8array);
        this.clean();
        return out;
    }
    async authInit(password) {
        if (this.status !== OpaqueClient.States.NEW) {
            return new Error('client not ready');
        }
        const password_u8array = new TextEncoder().encode(password);
        const { request, blind } = await this.opaque_core.createCredentialRequest(password_u8array);
        const auth_init = await this.ake.start();
        const ke1 = new KE1(request, auth_init);
        this.blind = blind;
        this.password = password_u8array;
        this.ke1 = ke1;
        this.status = OpaqueClient.States.LOG_STARTED;
        return ke1;
    }
    async authFinish(ke2, server_identity, client_identity, context) {
        if (this.status !== OpaqueClient.States.LOG_STARTED ||
            typeof this.password === 'undefined' ||
            typeof this.blind === 'undefined' ||
            typeof this.ke1 === 'undefined') {
            return new Error('client not ready');
        }
        const te = new TextEncoder();
        // eslint-disable-next-line no-undefined
        const server_identity_u8array = server_identity ? te.encode(server_identity) : undefined;
        // eslint-disable-next-line no-undefined
        const client_identity_u8array = client_identity ? te.encode(client_identity) : undefined;
        const context_u8array = context ? te.encode(context) : new Uint8Array(0);
        const rec = await this.opaque_core.recoverCredentials(this.password, this.blind, ke2.response, server_identity_u8array, client_identity_u8array);
        if (rec instanceof Error) {
            return rec;
        }
        const { client_ake_keypair, server_public_key, export_key } = rec;
        const fin = await this.ake.finalize(client_identity_u8array ? client_identity_u8array : client_ake_keypair.public_key, client_ake_keypair.private_key, server_identity_u8array ? server_identity_u8array : server_public_key, server_public_key, this.ke1, ke2, context_u8array);
        if (fin instanceof Error) {
            return fin;
        }
        const { auth_finish, session_key } = fin;
        const ke3 = new KE3(auth_finish);
        this.clean();
        return { ke3, session_key: Array.from(session_key), export_key: Array.from(export_key) };
    }
    clean() {
        this.status = OpaqueClient.States.NEW;
        this.password = undefined; // eslint-disable-line no-undefined
        this.blind = undefined; // eslint-disable-line no-undefined
        this.ke1 = undefined; // eslint-disable-line no-undefined
    }
}
    
document.addEventListener('DOMContentLoaded', async () => {
    // so the info sent from client is sent to the flask server, the flask forwards it to the node.js endpoint exposed by express,
    // the ts lib proccesses the requests and sends responses through the flask server which forwards it to 
    // the clients, easy, right?
    
    const registerForm = document.getElementById('register-form'); 
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const server_identity = 'opaque-test-server'; 
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
            const result = await client.registerFinish(registrationResponse, username, server_identity);

        });
    }
});