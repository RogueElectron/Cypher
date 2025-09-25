
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

// Live visualization steps
const registrationSteps = [
    {
        id: 'input',
        title: 'password input',
        description: 'entering credentials locally',
        icon: '1'
    },
    {
        id: 'validation',
        title: 'input validation',
        description: 'checking password strength',
        icon: '2'
    },
    {
        id: 'generate-keys',
        title: 'generate keys',
        description: 'creating cryptographic keypair',
        icon: '3'
    },
    {
        id: 'registration-request',
        title: 'registration request',
        description: 'sending RegistrationRequest to server',
        icon: '4'
    },
    {
        id: 'server-response',
        title: 'server response',
        description: 'receiving RegistrationResponse',
        icon: '5'
    },
    {
        id: 'finalize',
        title: 'finalize registration',
        description: 'completing OPAQUE protocol',
        icon: '6'
    },
    {
        id: 'totp-setup',
        title: '2fa setup',
        description: 'configuring time-based authentication',
        icon: '7'
    },
    {
        id: 'totp-verify',
        title: 'verify 2fa',
        description: 'confirming totp code works',
        icon: '8'
    },
    {
        id: 'success',
        icon: '✓',
        title: 'registration complete',
        description: 'account created with 2fa enabled',
        dataFlow: null
    }
];

// Live visualization controller
class LiveVisualization {
    constructor() {
        this.currentStep = 0;
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
    
    setProcessing(stepId) {
        const element = document.getElementById(`step-${stepId}`);
        if (element) {
            element.classList.remove('active');
            element.classList.add('processing');
        }
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

// sidebar toggle stuff
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
    // Initialize live visualization
    liveViz = new LiveVisualization();
    
    // init sidebar toggle
    initSidebarToggle();
    
    // so the info sent from client is sent to the flask server, the flask forwards it to the node.js endpoint exposed by express,
    // the ts lib proccesses the requests and sends responses through the flask server which forwards it to 
    // the clients, easy, right?
    
    const registerForm = document.getElementById('register-form'); 
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearAlerts();
            
            // Step 1: Password Input
            liveViz.activateStep('input');
            liveViz.updateSecurityStatus('Password entered locally - never transmitted in plaintext');
            
            const formData = new FormData(registerForm);
            const username = formData.get('username');
            const password = formData.get('password');
            const confirmPassword = formData.get('confirm_password');
            
            // Validate inputs
            if (!username || !password || !confirmPassword) {
                showAlert('Please fill in all fields!', 'error');
                return;
            }
            
            // Step 2: Validation
            liveViz.activateStep('validation');
            await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for visualization
            
            if (!validatePasswords(password, confirmPassword)) {
                return;
            }
            
            liveViz.completeStep('validation');
            
            // Disable form during registration
            const submitButton = registerForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Registering...';
            
            try {
                // Step 3: OPRF Initialization
                liveViz.activateStep('oprf-init');
                liveViz.updateSecurityStatus('Generating cryptographic blinding - your password stays secure');
                await new Promise(resolve => setTimeout(resolve, 800));
                
                const client = new OpaqueClient(cfg);
                const request = await client.registerInit(password);
                const serRequest = request.serialize();
                
                liveViz.completeStep('oprf-init');
                
                // Step 4: Send Registration Request
                liveViz.activateStep('send-request');
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

                liveViz.completeStep('send-request');
                
                // Step 5: Server Processing
                liveViz.activateStep('server-processing');
                liveViz.updateSecurityStatus('Server processing blinded password - your actual password remains unknown');
                
                const { registrationResponse } = await response.json();
                const deSerRegResponse = RegistrationResponse.deserialize(cfg, registrationResponse);
                
                liveViz.completeStep('server-processing');
                
                // Step 6: Credential Generation
                liveViz.activateStep('credential-generation');
                liveViz.updateSecurityStatus('Creating your secure credential file locally');
                await new Promise(resolve => setTimeout(resolve, 600));
                
                const rec = await client.registerFinish(deSerRegResponse);
                const record = rec.record;
                const serRec = record.serialize();

                liveViz.completeStep('credential-generation');
                
                // Step 7: Final Registration
                liveViz.activateStep('final-registration');
                liveViz.updateSecurityStatus('Sending encrypted credential to server for storage');

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
                    liveViz.completeStep('final-registration');
                    
                    // Step 7: Show TOTP Setup
                    liveViz.activateStep('totp-setup');
                    liveViz.updateSecurityStatus('OPAQUE registration complete! Now setting up 2FA...');
                    
                    // Hide registration form and show TOTP phase
                    document.getElementById('register-form').parentElement.style.display = 'none';
                    document.getElementById('totp-phase').style.display = 'block';
                    document.getElementById('back-link').style.display = 'none';
                    
                    // Generate TOTP secret (you'll implement this)
                    generateTotpSecret();
                    
                    showAlert('OPAQUE registration successful! Please set up 2FA to complete registration.', 'success');
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
    
    // TOTP setup functions
    function generateTotpSecret() {
        // Generate a random TOTP secret (you'll implement proper generation)
        const secret = 'JBSWY3DPEHPK3PXP'; // placeholder - replace with actual generation
        document.getElementById('totp-secret').textContent = secret;
        
        // Generate QR code (you'll implement this)
        generateQrCode(secret);
    }
    
    function generateQrCode(secret) {
        // Placeholder for QR code generation
        const qrContainer = document.getElementById('qr-code');
        qrContainer.innerHTML = `
            <div class="text-center p-4" style="background: rgba(255,255,255,0.1); border-radius: 8px;">
                <i class="bi bi-qr-code" style="font-size: 120px; color: #667eea;"></i>
                <p class="text-secondary mt-2">QR Code will be generated here</p>
            </div>
        `;
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
                
                // Simulate TOTP verification (you'll implement actual verification)
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Step 8: Complete registration
                liveViz.activateStep('success');
                liveViz.updateSecurityStatus('Registration complete! Account secured with 2FA.');
                
                showAlert('Registration complete! You can now log in with your credentials and 2FA.', 'success');
                
                // Redirect to login after delay
                setTimeout(() => {
                    window.location.href = '/api/login';
                }, 2000);
                
            } catch (error) {
                console.error('TOTP verification error:', error);
                showAlert(`2FA verification failed: ${error.message || 'Invalid code'}`, 'error');
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