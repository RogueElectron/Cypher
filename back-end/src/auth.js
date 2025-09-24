import { 
    OpaqueClient,
    getOpaqueConfig,
    OpaqueID,
    OpaqueServer,
    KE2,
    KE3
  } from '@cloudflare/opaque-ts';

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

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearAlerts();
            
            const formData = new FormData(loginForm);
            const username = formData.get('username');
            const password = formData.get('password');
            
            // Validate inputs
            if (!username || !password) {
                showAlert('Please fill in all fields!', 'error');
                return;
            }
            
            // Disable form during login
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Logging in...';
            
            try {
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
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Login initialization failed');
                }

                const responseData = await response.json();  
                const ser_ke2 = responseData.ser_ke2;
                const deser_ke2 = KE2.deserialize(cfg, ser_ke2);
                const finClient = await client.authFinish(deser_ke2);
                const ke3 = finClient.ke3;
                const ser_ke3 = ke3.serialize();
                console.log('session', finClient.session_key);
                
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
                
                if (!result.ok) {
                    const errorData = await result.json();
                    throw new Error(errorData.error || 'Login completion failed');
                }
                
                const loginResult = await result.json();
                
                if (loginResult.success) {
                    showAlert(`Login successful! Welcome back, ${username}!`, 'success');
                    loginForm.reset();
                    
                    // Redirect to dashboard/home after 2 seconds
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                } else {
                    throw new Error(loginResult.message || 'Invalid credentials');
                }
                
            } catch (error) {
                console.error('Login error:', error);
                let errorMessage = error.message;
                
                // Handle specific error cases
                if (error.message.includes('client not registered')) {
                    errorMessage = 'User not found. Please register first.';
                } else if (error.message.includes('Authentication failed')) {
                    errorMessage = 'Invalid username or password.';
                }
                
                showAlert(`Login failed: ${errorMessage}`, 'error');
            } finally {
                // Re-enable form
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        });
    }
});
