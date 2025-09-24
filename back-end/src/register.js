
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

// Utility functions for UI feedback
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
    const iconClass = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
    
    alertContainer.innerHTML = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
            <i class="${iconClass} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    // Auto-dismiss success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            const alert = alertContainer.querySelector('.alert');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }
}

function clearAlerts() {
    const alertContainer = document.getElementById('alert-container');
    alertContainer.innerHTML = '';
}

function validatePasswords(password, confirmPassword) {
    if (password !== confirmPassword) {
        showAlert('Passwords do not match!', 'error');
        return false;
    }
    if (password.length < 8) {
        showAlert('Password must be at least 8 characters long!', 'error');
        return false;
    }
    return true;
}
    
document.addEventListener('DOMContentLoaded', async () => {
    // so the info sent from client is sent to the flask server, the flask forwards it to the node.js endpoint exposed by express,
    // the ts lib proccesses the requests and sends responses through the flask server which forwards it to 
    // the clients, easy, right?
    
    const registerForm = document.getElementById('register-form'); 
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearAlerts();
            
            const formData = new FormData(registerForm);
            const username = formData.get('username');
            const password = formData.get('password');
            const confirmPassword = formData.get('confirm_password');
            
            // Validate inputs
            if (!username || !password || !confirmPassword) {
                showAlert('Please fill in all fields!', 'error');
                return;
            }
            
            if (!validatePasswords(password, confirmPassword)) {
                return;
            }
            
            // Disable form during registration
            const submitButton = registerForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Registering...';
            
            try {
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
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Registration failed');
                }

                const { registrationResponse } = await response.json();
                const deSerRegResponse = RegistrationResponse.deserialize(cfg, registrationResponse);
                const rec = await client.registerFinish(deSerRegResponse);
                const record = rec.record;
                const serRec = record.serialize();

                const finishResponse = await fetch('http://localhost:3000/register/finish', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username,
                        record: serRec
                    })
                });
                
                if (!finishResponse.ok) {
                    const errorData = await finishResponse.json();
                    throw new Error(errorData.error || 'Registration completion failed');
                }
                
                const finishResult = await finishResponse.json();
                
                if (finishResult.success) {
                    showAlert(`Registration successful! Welcome, ${username}! You can now log in with your credentials.`, 'success');
                    registerForm.reset();
                    
                    // Redirect to login page after 3 seconds
                    setTimeout(() => {
                        window.location.href = '/api/login';
                    }, 3000);
                } else {
                    throw new Error('Registration failed - please try again');
                }
                
            } catch (error) {
                console.error('Registration error:', error);
                showAlert(`Registration failed: ${error.message}`, 'error');
            } finally {
                // Re-enable form
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        });
    }
});