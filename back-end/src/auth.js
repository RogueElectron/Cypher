import { 
    OpaqueClient,
    getOpaqueConfig,
    OpaqueID,
    OpaqueServer,
    KE2,
    KE3
  } from '@cloudflare/opaque-ts';

const cfg = getOpaqueConfig(OpaqueID.OPAQUE_P256);

// Live visualization steps for authentication
const authenticationSteps = [
    {
        id: 'input',
        icon: 'bi-keyboard',
        title: 'Password Input',
        description: 'Your password is entered locally and never transmitted',
        dataFlow: null
    },
    {
        id: 'validation',
        icon: 'bi-check-circle',
        title: 'Input Validation',
        description: 'Validating credentials before starting authentication',
        dataFlow: null
    },
    {
        id: 'ke1-generation',
        icon: 'bi-cpu',
        title: 'Generate KE1',
        description: 'Creating first key exchange message without exposing password',
        dataFlow: null
    },
    {
        id: 'send-ke1',
        icon: 'bi-arrow-up-circle',
        title: 'Send Authentication Request',
        description: 'Sending KE1 message to server (no password data included)',
        dataFlow: 'KE1 Message → Server'
    },
    {
        id: 'server-ke2',
        icon: 'bi-server',
        title: 'Server Response',
        description: 'Server generates KE2 using stored encrypted credentials',
        dataFlow: 'KE2 Message ← Server'
    },
    {
        id: 'verify-server',
        icon: 'bi-shield-check',
        title: 'Verify Server',
        description: 'Authenticating server and generating session key locally',
        dataFlow: null
    },
    {
        id: 'send-ke3',
        icon: 'bi-arrow-up-circle',
        title: 'Send Authentication Proof',
        description: 'Sending KE3 proof to complete mutual authentication',
        dataFlow: 'KE3 Proof → Server'
    },
    {
        id: 'success',
        icon: 'bi-check-circle-fill',
        title: 'Authentication Complete',
        description: 'Successfully authenticated! Session established securely.',
        dataFlow: null
    }
];

// Live visualization controller for authentication
class AuthLiveVisualization {
    constructor() {
        this.currentStep = 0;
        this.steps = authenticationSteps;
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
let authLiveViz;

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

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize live visualization
    authLiveViz = new AuthLiveVisualization();
    
    // init sidebar toggle
    initSidebarToggle();
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearAlerts();
            
            // Step 1: Password Input
            authLiveViz.activateStep('input');
            authLiveViz.updateSecurityStatus('Password entered locally - never transmitted in plaintext');
            
            const formData = new FormData(loginForm);
            const username = formData.get('username');
            const password = formData.get('password');
            
            // Validate inputs
            if (!username || !password) {
                showAlert('Please fill in all fields!', 'error');
                return;
            }
            
            // Step 2: Validation
            authLiveViz.activateStep('validation');
            await new Promise(resolve => setTimeout(resolve, 400)); // Brief pause for visualization
            
            authLiveViz.completeStep('validation');
            
            // Disable form during login
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Logging in...';
            
            try {
                // Step 3: KE1 Generation
                authLiveViz.activateStep('ke1-generation');
                authLiveViz.updateSecurityStatus('Generating key exchange message without exposing password');
                await new Promise(resolve => setTimeout(resolve, 600));
                
                const client = new OpaqueClient(cfg);
                const ke1 = await client.authInit(password);
                const ser_ke1 = ke1.serialize();

                authLiveViz.completeStep('ke1-generation');
                
                // Step 4: Send KE1
                authLiveViz.activateStep('send-ke1');
                authLiveViz.updateSecurityStatus('Sending authentication request - no password data transmitted');

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

                authLiveViz.completeStep('send-ke1');
                
                // Step 5: Server KE2 Response
                authLiveViz.activateStep('server-ke2');
                authLiveViz.updateSecurityStatus('Server responding with encrypted challenge using stored credentials');

                const responseData = await response.json();  
                const ser_ke2 = responseData.ser_ke2;
                const deser_ke2 = KE2.deserialize(cfg, ser_ke2);
                
                authLiveViz.completeStep('server-ke2');
                
                // Step 6: Verify Server
                authLiveViz.activateStep('verify-server');
                authLiveViz.updateSecurityStatus('Verifying server authenticity and generating session key');
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const finClient = await client.authFinish(deser_ke2);
                const ke3 = finClient.ke3;
                const ser_ke3 = ke3.serialize();
                console.log('session', finClient.session_key);
                
                authLiveViz.completeStep('verify-server');
                
                // Step 7: Send KE3
                authLiveViz.activateStep('send-ke3');
                authLiveViz.updateSecurityStatus('Sending authentication proof to complete mutual authentication');
                
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
                    authLiveViz.completeStep('send-ke3');
                    
                    // Step 8: Success
                    authLiveViz.activateStep('success');
                    authLiveViz.updateSecurityStatus('Authentication complete! Session established securely without password exposure.');
                    
                    showAlert(`Login successful! Welcome back, ${username}!`, 'success');
                    loginForm.reset();
                    
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
