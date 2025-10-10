#!/usr/bin/env node

/**
 * Simple headless browser automation - just acts like a human user
 * Fills forms, clicks buttons, lets the existing JS handle all crypto
 */

const { chromium } = require('playwright');
const { authenticator } = require('otplib');

async function automateUserRegistration(baseUrl = 'http://localhost:5000', options = {}) {
    const {
        username = `demo_${Date.now()}`,
        password = 'DemoPassword123!',
        headless = true,
        slowMo = 500  // Add delays to see what's happening
    } = options;

    console.log(`Starting user automation for: ${username}`);
    
    const browser = await chromium.launch({ 
        headless,
        slowMo,
        args: ['--disable-web-security']
    });
    
    try {
        const page = await browser.newPage();
        
        // Log what's happening in the browser
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`Browser Error: ${msg.text()}`);
            } else {
                console.log(`Browser: ${msg.text()}`);
            }
        });
        
        // Step 1: Navigate to home page and click "Get Started"
        console.log('Navigating to home page...');
        await page.goto(baseUrl);
        await page.waitForLoadState('networkidle');
        
        console.log('Looking for "Get Started" button...');
        // Try different possible selectors for "Get Started"
        const getStartedSelectors = [
            'text=Get Started',
            'a[href*="register"]', 
            'button:has-text("Get Started")',
            '.btn:has-text("Get Started")',
            '#get-started'
        ];
        
        let getStartedButton = null;
        for (const selector of getStartedSelectors) {
            try {
                getStartedButton = await page.waitForSelector(selector, { timeout: 2000 });
                if (getStartedButton) {
                    console.log(`Found "Get Started" with selector: ${selector}`);
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }
        
        if (!getStartedButton) {
            console.log('No "Get Started" button found, navigating directly to /api/register');
            await page.goto(`${baseUrl}/api/register`);
        } else {
            await getStartedButton.click();
            console.log('Clicked "Get Started"');
        }
        
        await page.waitForLoadState('networkidle');
        
        // Step 2: Fill in registration form
        console.log('Filling registration form...');
        
        // Wait for form to be ready
        await page.waitForSelector('#register-form, form', { timeout: 10000 });
        
        // Fill username
        console.log(`Entering username: ${username}`);
        await page.fill('#username, input[name="username"]', username);
        
        // Fill password  
        console.log('Entering password');
        await page.fill('#password, input[name="password"]', password);
        
        // Fill confirm password
        console.log('Confirming password');
        await page.fill('#confirm-password, #confirm_password, input[name="confirm_password"]', password);
        
        // Step 3: Submit form (let JavaScript take over)
        console.log('Submitting registration form...');
        await page.click('button[type="submit"], #register-btn, .btn-primary');
        
        // Step 4: Wait for OPAQUE operations to complete
        console.log('Waiting for OPAQUE crypto operations...');
        
        // Wait for either success or the TOTP phase to appear
        try {
            await page.waitForSelector('#totp-phase, #totp-verify-form, .totp-setup', { timeout: 30000 });
            console.log('OPAQUE registration completed - TOTP phase started');
        } catch (e) {
            // Check if there was an error
            const errorAlert = await page.$('.alert-danger');
            if (errorAlert) {
                const errorText = await errorAlert.textContent();
                throw new Error(`Registration failed: ${errorText}`);
            }
            throw new Error('TOTP phase did not appear - registration may have failed');
        }
        
        // Step 5: Handle TOTP setup (this is the tricky part)
        console.log('TOTP setup phase detected...');
        
        // For demo purposes, we'll need to either:
        // 1. Extract the TOTP secret and generate a code
        // 2. Or skip this step and return partial success
        
        try {
            // Wait a moment for TOTP secret to be fully rendered
            await page.waitForSelector('#totp-secret', { timeout: 5000 });
            
            // Extract TOTP secret from the page
            const totpSecret = await page.textContent('#totp-secret');
            
            if (totpSecret && totpSecret.trim()) {
                console.log(`TOTP Secret found: ${totpSecret}`);
                
                // Generate current TOTP code using the secret
                const totpCode = authenticator.generate(totpSecret.trim());
                console.log(`Generated TOTP code: ${totpCode}`);
                
                // Fill in the TOTP code
                console.log('Entering TOTP code...');
                await page.fill('#totp-code', totpCode);
                
                // Submit the form
                console.log('Submitting TOTP verification...');
                await page.click('#totp-verify-form button[type="submit"]');
                
                // Wait for completion - either success alert or redirect to login
                await page.waitForFunction(() => {
                    const successAlert = document.querySelector('.alert-success');
                    const errorAlert = document.querySelector('.alert-danger');
                    const isRedirected = window.location.href.includes('/login');
                    
                    return successAlert || isRedirected || errorAlert;
                }, { timeout: 15000 });
                
                // Check the result
                const successAlert = await page.$('.alert-success');
                const errorAlert = await page.$('.alert-danger');
                const currentUrl = page.url();
                
                if (successAlert || currentUrl.includes('/login')) {
                    console.log('Registration fully completed with 2FA!');
                    return {
                        success: true,
                        username,
                        password,
                        totpSecret,
                        completedTotp: true,
                        message: 'Full registration with 2FA completed successfully'
                    };
                } else if (errorAlert) {
                    const errorText = await errorAlert.textContent();
                    console.log(`TOTP verification failed: ${errorText}`);
                    return {
                        success: false,
                        error: `TOTP verification failed: ${errorText}`,
                        username,
                        password,
                        totpSecret
                    };
                } else {
                    throw new Error('Unknown result after TOTP submission');
                }
            } else {
                console.log('Could not extract TOTP secret - partial success');
                return {
                    success: true,
                    username,
                    password, 
                    completedTotp: false,
                    message: 'OPAQUE registration completed, TOTP secret not found'
                };
            }
        } catch (totpError) {
            console.log(`TOTP completion failed: ${totpError.message}`);
            return {
                success: true,
                username,
                password,
                completedTotp: false,
                message: 'OPAQUE registration completed, TOTP setup needs manual completion'
            };
        }
        
    } catch (error) {
        console.error('Automation failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (!options.keepOpen) {
            await browser.close();
        }
    }
}

// TOTP generator is now handled by otplib library in the main function

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const baseUrl = args[0] || 'http://localhost:5000';
    const username = args[1];
    const headless = !args.includes('--visible');
    
    automateUserRegistration(baseUrl, { 
        username, 
        headless,
        keepOpen: args.includes('--keep-open')
    })
        .then(result => {
            console.log('\nAutomation Result:');
            console.log(JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { automateUserRegistration };
