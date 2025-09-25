
import { 
  OpaqueClient,
  getOpaqueConfig,
  OpaqueID,
  RegistrationResponse
} from '@cloudflare/opaque-ts';


const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);

const registrationSteps = [
    {
        id: 'input',
        title: 'Password Input',
        description: 'Your password is entered locally and never transmitted',
        icon: 'bi-keyboard',
        dataFlow: null
    },
    {
        id: 'validation',
        title: 'Input Validation',
        description: 'Validating password strength and confirmation',
        icon: 'bi-check-circle',
        dataFlow: null
    },
    {
        id: 'generate-keys',
        title: 'Generate Keys',
        description: 'Creating cryptographic keypair for secure registration',
        icon: 'bi-cpu',
        dataFlow: null
    },
    {
        id: 'registration-request',
        title: 'Registration Request',
        description: 'Sending encrypted registration data to server',
        icon: 'bi-arrow-up-circle',
        dataFlow: 'Registration Request → Server'
    },
    {
        id: 'server-response',
        title: 'Server Response',
        description: 'Server processing registration with OPAQUE protocol',
        icon: 'bi-server',
        dataFlow: 'Registration Response ← Server'
    },
    {
        id: 'finalize',
        title: 'Finalize Registration',
        description: 'Completing OPAQUE protocol and storing credentials',
        icon: 'bi-shield-check',
        dataFlow: null
    },
    {
        id: 'totp-setup',
        title: '2FA Setup',
        description: 'Configuring time-based authentication',
        icon: 'bi-shield-lock',
        dataFlow: null
    },
    {
        id: 'totp-verify',
        title: 'Verify 2FA',
        description: 'Confirming TOTP code functionality',
        icon: 'bi-check-circle-fill',
        dataFlow: null
    },
    {
        id: 'success',
        title: 'Registration Complete',
        description: 'Account created successfully with 2FA enabled',
        icon: 'bi-check-circle-fill',
        dataFlow: null
    }
];

// Live visualization controller for registration
class LiveVisualization {
    constructor() {
        this.steps = registrationSteps;
        this.init();
    }
    
    init() {
        this.renderSteps();
    }
    
    renderSteps() {
        const container = document.getElementById('live-steps');
        if (!container) return;
        
        container.innerHTML = this.steps.map((step, index) => `
            <div class="live-step" id="step-${step.id}">
                <div class="step-icon">
                    <i class="${step.icon}"></i>
                </div>
                <div class="step-content">
                    <div class="step-title">${step.title}</div>
                    <div class="step-description">${step.description}</div>
                    ${step.dataFlow ? `<div class="data-flow">${step.dataFlow}</div>` : ''}
                </div>
            </div>
        `).join('');
    }
    
    activateStep(stepId) {
        const currentIndex = this.steps.findIndex(step => step.id === stepId);
        
        // batch dom updates for better performance
        this.steps.forEach((step, index) => {
            const element = document.getElementById(`step-${step.id}`);
            if (element) {
                element.className = element.className.replace(/\b(active|processing|completed)\b/g, '').trim();
                if (index < currentIndex) {
                    element.classList.add('completed');
                } else if (index === currentIndex) {
                    element.classList.add('active');
                }
            }
        });
    }
    
    completeStep(stepId) {
        const element = document.getElementById(`step-${stepId}`);
        if (element) {
            element.classList.remove('active', 'processing');
            element.classList.add('completed');
        }
    }
    
    updateSecurityStatus(message, type = 'success') {
        const statusElement = document.getElementById('security-status');
        if (statusElement) {
            const icon = type === 'success' ? 'bi-shield-check' : 'bi-shield-exclamation';
            const colorClass = type === 'success' ? 'text-success' : 'text-warning';
            
            statusElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="${icon} ${colorClass} me-2"></i>
                    <span class="text-white">${message}</span>
                </div>
            `;
        }
    }
}

// Initialize live visualization
let liveViz;

// Sidebar toggle functionality
function initSidebarToggle() {
    const hideBtn = document.getElementById('hide-sidebar');
    const showBtn = document.getElementById('show-sidebar');
    const panel = document.getElementById('visualization-panel');
    
    if (hideBtn && showBtn && panel) {
        hideBtn.addEventListener('click', () => {
            panel.classList.add('hidden');
            showBtn.style.display = 'block';
        });
        
        showBtn.addEventListener('click', () => {
            panel.classList.remove('hidden');
            showBtn.style.display = 'none';
        });
    }
}

// Utility functions for UI feedback
function showAlert(message, type = 'success', containerId = 'alert-container') {
    const alertContainer = document.getElementById(containerId);
    if (!alertContainer) {
        return;
    }
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
    const defaultContainer = document.getElementById('alert-container');
    if (defaultContainer) {
        defaultContainer.innerHTML = '';
    }
    const totpContainer = document.getElementById('totp-alert-container');
    if (totpContainer) {
        totpContainer.innerHTML = '';
    }
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
    liveViz = new LiveVisualization();
    
    initSidebarToggle();
        
    const registerForm = document.getElementById('register-form'); 
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearAlerts();
            
            liveViz.activateStep('input');
            liveViz.updateSecurityStatus('Password entered locally - never transmitted in plaintext');
            
            const formData = new FormData(registerForm);
            const username = formData.get('username');
            const password = formData.get('password');
            const confirmPassword = formData.get('confirm_password');
            
            if (!username || !password || !confirmPassword) {
                showAlert('Please fill in all fields!', 'error');
                return;
            }
            
            liveViz.activateStep('validation');
            await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for visualization
            
            if (!validatePasswords(password, confirmPassword)) {
                return;
            }
            
            liveViz.completeStep('validation');
            
            const submitButton = registerForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Registering...';
            
            try {
                liveViz.activateStep('generate-keys');
                liveViz.updateSecurityStatus('Generating cryptographic blinding - your password stays secure');
                await new Promise(resolve => setTimeout(resolve, 800));
                
                const client = new OpaqueClient(cfg);
                const request = await client.registerInit(password);
                const serRequest = request.serialize();
                
                liveViz.completeStep('generate-keys');
                
                liveViz.activateStep('registration-request');
                liveViz.updateSecurityStatus('Sending blinded password to server - original password never leaves this device');
                
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

                liveViz.completeStep('registration-request');
                
                liveViz.activateStep('server-response');
                liveViz.updateSecurityStatus('Server processing blinded password - your actual password remains unknown');
                
                const { registrationResponse } = await response.json();
                const deSerRegResponse = RegistrationResponse.deserialize(cfg, registrationResponse);
                
                liveViz.completeStep('server-response');
                
                liveViz.activateStep('finalize');
                liveViz.updateSecurityStatus('Creating your secure credential file locally');
                await new Promise(resolve => setTimeout(resolve, 600));
                
                const rec = await client.registerFinish(deSerRegResponse);
                const record = rec.record;
                const serRec = record.serialize();

                liveViz.completeStep('finalize');

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
                    
                    liveViz.activateStep('totp-setup');
                    liveViz.updateSecurityStatus('OPAQUE registration complete! Now setting up 2FA...');
                    

                    document.getElementById('register-form').parentElement.style.display = 'none';
                    document.getElementById('totp-phase').style.display = 'block';
                    document.getElementById('back-link').style.display = 'none';
                    
                    
                    generateTotpSecret();
                    
                    showAlert('OPAQUE registration successful! Please set up 2FA to complete registration.', 'success');
                } else {
                    throw new Error('Registration failed - please try again');
                }
                
            } catch (error) {
                console.error('Registration error:', error);
                showAlert(`Registration failed: ${error.message}`, 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        });
    }
    
    // TOTP setup
    async function generateTotpSecret() {
        try {
            const username = document.getElementById('username').value;
            
            const response = await fetch('http://localhost:3000/totp/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });
            
            if (!response.ok) {
                throw new Error('Failed to setup TOTP');
            }
            
            const result = await response.json();
            
            document.getElementById('totp-secret').textContent = result.secret;
            
            window.currentUsername = username;
            
            displayServerQrCode(result.qrCode, result.otpauthUrl);
            
            showTotpInfo(result.secret);
            
            return result.secret;
            
        } catch (error) {
            console.error('TOTP setup error:', error);
            showAlert(`TOTP setup failed: ${error.message}`, 'error');
            throw error;
        }
    }
    
    function displayServerQrCode(qrCodeDataURL, otpauthUrl) {
        const qrContainer = document.getElementById('qr-code');
        qrContainer.innerHTML = `
            <div class="text-center p-4" style="background: rgba(255,255,255,0.1); border-radius: 8px;">
                <div class="mb-3">
                    <img src="${qrCodeDataURL}" alt="TOTP QR Code" style="border-radius: 8px; max-width: 200px; max-height: 200px;">
                </div>
                <small class="text-secondary">Scan with Google Authenticator, Authy, or similar app</small>
                <div class="mt-2">
                    <small class="text-muted">Or copy this URI:</small>
                    <div class="mt-1">
                        <input type="text" class="form-control form-control-sm" value="${otpauthUrl}" readonly onclick="this.select()" style="font-size: 10px;">
                    </div>
                </div>
            </div>
        `;
    }
    
    function showTotpInfo(secret) {
        // Blue info box removed for streamlined UI
    }
    
    
    // TOTP verification form handler
    const totpForm = document.getElementById('totp-verify-form');
    if (totpForm) {
        totpForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearAlerts();
            
            const formData = new FormData(totpForm);
            const totpCode = formData.get('totp_code');
            
            // Validate TOTP code
            if (!totpCode || totpCode.length !== 6) {
                showAlert('Please enter a valid 6-digit code!', 'error');
                return;
            }
            
            // Disable form during verification
            const submitButton = totpForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>verifying...';
            
            try {
                liveViz.activateStep('totp-verify');
                liveViz.updateSecurityStatus('Verifying 2FA code...');
                
                const username = window.currentUsername;
                if (!username) {
                    showAlert('Username not found. Please restart registration.', 'error', 'totp-alert-container');
                    liveViz.updateSecurityStatus('TOTP verification failed. Please restart registration.', 'error');
                    return;
                }

                const verifyResponse = await fetch('http://localhost:3000/totp/verify-setup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username,
                        token: totpCode
                    })
                });

                const verifyResult = await verifyResponse.json();

                if (!verifyResponse.ok || !verifyResult.success) {
                    const errorMessage = verifyResult.error || 'Invalid TOTP code';
                    showAlert(`2FA verification failed: ${errorMessage}`, 'error', 'totp-alert-container');
                    liveViz.updateSecurityStatus('TOTP verification failed. Please try again.', 'error');
                    return;
                }

                liveViz.activateStep('success');
                liveViz.updateSecurityStatus('Registration complete! Account secured with 2FA.');
                showAlert('Registration complete! You can now log in with your credentials and 2FA.', 'success', 'totp-alert-container');

                setTimeout(() => {
                    window.location.href = '/api/login';
                }, 2000);
            } catch (error) {
                console.error('TOTP verification error:', error);
                showAlert(`2FA verification failed: ${error.message || 'Invalid code'}`, 'error', 'totp-alert-container');
                liveViz.updateSecurityStatus('TOTP verification failed. Please try again.', 'error');
            } finally {
                // Re-enable form
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
            }
        });
    }
    
    // Format TOTP input
    const totpInput = document.getElementById('totp-code');
    if (totpInput) {
        totpInput.addEventListener('input', () => {
            // Only allow numbers
            totpInput.value = totpInput.value.replace(/[^0-9]/g, '');
            
            // Limit to 6 digits
            if (totpInput.value.length > 6) {
                totpInput.value = totpInput.value.slice(0, 6);
            }
        });
    }
});