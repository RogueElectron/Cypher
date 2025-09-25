/**
 * Index page functionality with session management
 */

import { sessionManager } from './session-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    const heroSection = document.querySelector('.hero-section');
    const container = heroSection.querySelector('.container');
    
    // Load session and check if user is authenticated
    const hasSession = sessionManager.loadTokens();
    
    if (hasSession) {
        try {
            const currentUser = await sessionManager.getCurrentUser();
            
            if (currentUser) {
                // User is authenticated - show welcome message
                showAuthenticatedView(currentUser.username, container);
            } else {
                // Token invalid - show default view
                showUnauthenticatedView(container);
            }
        } catch (error) {
            console.error('Session validation error:', error);
            showUnauthenticatedView(container);
        }
    } else {
        // No session - show default view
        showUnauthenticatedView(container);
    }
});

function showAuthenticatedView(username, container) {
    container.innerHTML = `
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <div class="text-center mb-4">
                    <img src="/static/svg/cypher.svg" alt="Cypher" style="height: 120px; width: auto;">
                </div>
                <div class="text-center mb-4">
                    <h2 class="text-light mb-3">Welcome back, ${escapeHtml(username)}!</h2>
                    <p class="hero-subtitle">Your secure session is active</p>
                </div>
                <div class="hero-buttons">
                    <button id="logout-btn" class="btn btn-outline-light btn-lg" style="min-width: 150px; height: 48px;">
                        <i class="bi bi-box-arrow-right me-2"></i>Logout
                    </button>
                    <button class="btn btn-primary btn-lg glow" style="min-width: 150px; height: 48px;">
                        <i class="bi bi-shield-check me-2"></i>Dashboard
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Session info -->
        <div class="row mt-5 pt-5">
            <div class="col-lg-8 mx-auto">
                <div class="glass-card p-4">
                    <div class="row text-center">
                        <div class="col-md-4">
                            <div class="mb-3">
                                <i class="bi bi-shield-check text-success" style="font-size: 2rem;"></i>
                            </div>
                            <h6 class="text-light">Authenticated</h6>
                            <p class="text-secondary small mb-0">OPAQUE protocol</p>
                        </div>
                        <div class="col-md-4">
                            <div class="mb-3">
                                <i class="bi bi-key text-primary" style="font-size: 2rem;"></i>
                            </div>
                            <h6 class="text-light">Session Active</h6>
                            <p class="text-secondary small mb-0">PASETO tokens</p>
                        </div>
                        <div class="col-md-4">
                            <div class="mb-3">
                                <i class="bi bi-clock text-info" style="font-size: 2rem;"></i>
                            </div>
                            <h6 class="text-light">Auto-refresh</h6>
                            <p class="text-secondary small mb-0">Seamless experience</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

function showUnauthenticatedView(container) {
    // Keep the original content for unauthenticated users
    container.innerHTML = `
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <div class="text-center mb-4">
                    <img src="/static/svg/cypher.svg" alt="Cypher" style="height: 120px; width: auto;">
                </div>
                <p class="hero-subtitle">Next-generation authentication platform with zero-knowledge security</p>
                <div class="hero-buttons">
                    <a href="/api/login" class="btn btn-outline-light btn-lg" style="min-width: 150px; height: 48px; display: inline-flex; align-items: center; justify-content: center;">Sign In</a>
                    <a href="/api/register" class="btn btn-primary btn-lg glow" style="min-width: 150px; height: 48px; display: inline-flex; align-items: center; justify-content: center;">Get Started</a>
                </div>
            </div>
        </div>
        
        <!-- simple info section -->
        <div class="row mt-5 pt-5">
            <div class="col-lg-8 mx-auto">
                <div class="glass-card p-4 text-center">
                    <p class="text-secondary mb-0">
                        built with the OPAQUE protocol, your password never leaves your device
                    </p>
                </div>
            </div>
        </div>
    `;
}

async function handleLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    
    if (logoutBtn) {
        const originalText = logoutBtn.innerHTML;
        logoutBtn.disabled = true;
        logoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging out...';
        
        try {
            await sessionManager.logout();
            
            // Show success message briefly
            logoutBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Logged out';
            
            // Refresh page after short delay
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (error) {
            console.error('Logout error:', error);
            
            // Still clear the session even if server call failed
            sessionManager.clearSession();
            
            logoutBtn.innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i>Logged out';
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
