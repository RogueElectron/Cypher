// totp ui and live visualization

class TotpLiveVisualization {
    constructor() {
        this.steps = [
            {
                id: 'generate',
                title: 'generate secret',
                description: 'creating unique totp secret key',
                icon: '1'
            },
            {
                id: 'qr-code',
                title: 'display qr code',
                description: 'showing scannable qr code',
                icon: '2'
            },
            {
                id: 'scan',
                title: 'scan with app',
                description: 'user scans qr with authenticator',
                icon: '3'
            },
            {
                id: 'verify',
                title: 'verify code',
                description: 'confirming totp code works',
                icon: '4'
            },
            {
                id: 'complete',
                title: '2fa enabled',
                description: 'account secured with 2fa',
                icon: '✓'
            }
        ];
        
        this.init();
    }
    
    init() {
        const container = document.getElementById('live-steps');
        if (!container) return;
        
        container.innerHTML = this.steps.map(step => `
            <div class="live-step" id="step-${step.id}">
                <div class="step-icon">${step.icon}</div>
                <div class="step-content">
                    <div class="step-title">${step.title}</div>
                    <div class="step-description">${step.description}</div>
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
            const iconClass = type === 'success' ? 'bi-shield-check text-success' : 
                             type === 'warning' ? 'bi-shield-exclamation text-warning' : 
                             'bi-shield-x text-danger';
            
            statusElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="${iconClass} me-2" style="font-size: 14px;"></i>
                    <small class="text-white">${message}</small>
                </div>
            `;
        }
    }
}

// initialize live visualization
let totpLiveViz;

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

// utility functions for ui feedback
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
    const iconClass = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
    
    alertContainer.innerHTML = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
            <i class="${iconClass} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // auto dismiss success alerts after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            const alert = alertContainer.querySelector('.alert');
            if (alert) {
                alert.classList.remove('show');
                setTimeout(() => alert.remove(), 150);
            }
        }, 5000);
    }
}

function clearAlerts() {
    const alertContainer = document.getElementById('alert-container');
    alertContainer.innerHTML = '';
}

// phase switching
function showSetupPhase() {
    document.getElementById('setup-phase').style.display = 'block';
    document.getElementById('verify-phase').style.display = 'none';
}

function showVerifyPhase() {
    document.getElementById('setup-phase').style.display = 'none';
    document.getElementById('verify-phase').style.display = 'block';
}

// totp code formatting
function formatTotpInput(input) {
    // only allow numbers
    input.value = input.value.replace(/[^0-9]/g, '');
    
    // limit to 6 digits
    if (input.value.length > 6) {
        input.value = input.value.slice(0, 6);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // initialize live visualization
    totpLiveViz = new TotpLiveVisualization();
    
    // init sidebar toggle
    initSidebarToggle();
    
    // format totp inputs
    const totpInputs = document.querySelectorAll('#totp-code, #verify-code');
    totpInputs.forEach(input => {
        input.addEventListener('input', () => formatTotpInput(input));
        input.addEventListener('paste', (e) => {
            setTimeout(() => formatTotpInput(input), 0);
        });
    });
    
    // setup form handler
    const setupForm = document.getElementById('totp-setup-form');
    if (setupForm) {
        setupForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearAlerts();
            
            // step 1: generate secret
            totpLiveViz.activateStep('generate');
            totpLiveViz.updateSecurityStatus('generating unique totp secret...');
            
            const formData = new FormData(setupForm);
            const totpCode = formData.get('totp_code');
            
            // validate totp code
            if (!totpCode || totpCode.length !== 6) {
                showAlert('please enter a valid 6-digit code!', 'error');
                return;
            }
            
            // disable form during setup
            const submitButton = setupForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>verifying...';
            
            try {
                // step 2: verify code
                totpLiveViz.activateStep('verify');
                totpLiveViz.updateSecurityStatus('verifying totp code...');
                
                // simulate api call - you'll replace this with actual logic
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // step 3: complete
                totpLiveViz.activateStep('complete');
                totpLiveViz.updateSecurityStatus('2fa successfully enabled for your account');
                
                showAlert('two-factor authentication enabled successfully!', 'success');
                setupForm.reset();
                
                // redirect or show success state
                setTimeout(() => {
                    // you can redirect or show different ui here
                    console.log('totp setup complete');
                }, 2000);
                
            } catch (error) {
                console.error('totp setup error:', error);
                showAlert(`setup failed: ${error.message || 'please try again'}`, 'error');
            } finally {
                // re-enable form
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
            }
        });
    }
    
    // verify form handler
    const verifyForm = document.getElementById('totp-verify-form');
    if (verifyForm) {
        verifyForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearAlerts();
            
            const formData = new FormData(verifyForm);
            const verifyCode = formData.get('verify_code');
            
            // validate code
            if (!verifyCode || verifyCode.length !== 6) {
                showAlert('please enter a valid 6-digit code!', 'error');
                return;
            }
            
            // disable form during verification
            const submitButton = verifyForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>verifying...';
            
            try {
                totpLiveViz.activateStep('verify');
                totpLiveViz.updateSecurityStatus('verifying 2fa code...');
                
                // simulate api call - you'll replace this with actual logic
                await new Promise(resolve => setTimeout(resolve, 800));
                
                totpLiveViz.completeStep('verify');
                totpLiveViz.updateSecurityStatus('code verified successfully');
                
                showAlert('verification successful!', 'success');
                verifyForm.reset();
                
            } catch (error) {
                console.error('totp verification error:', error);
                showAlert(`verification failed: ${error.message || 'invalid code'}`, 'error');
            } finally {
                // re-enable form
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
            }
        });
    }
    
    // initialize first step
    totpLiveViz.activateStep('generate');
    totpLiveViz.updateSecurityStatus('ready to set up two-factor authentication');
});
