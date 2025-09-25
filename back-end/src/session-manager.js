/**
 * Session Token Manager - Handles PASETO access and refresh tokens
 */

class SessionManager {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.refreshTimeout = null;
        this.isRefreshing = false;
        this.refreshPromise = null;
    }

    // Cookie utility functions
    setCookie(name, value, maxAge) {
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        const cookie = `${name}=${value}; Max-Age=${maxAge}; SameSite=Lax; Path=/${secure}`;
        document.cookie = cookie;
        console.log('Setting cookie:', cookie);
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    deleteCookie(name) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    }

    // Store tokens after successful login
    setTokens(accessToken, refreshToken, expiresIn) {
        console.log('setTokens called with:', { accessToken: accessToken ? 'present' : 'missing', refreshToken: refreshToken ? 'present' : 'missing', expiresIn });
        
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        
        // Store in cookies for persistence
        this.setCookie('access_token', accessToken, expiresIn); // 15 minutes
        this.setCookie('refresh_token', refreshToken, 2592000); // 30 days
        
        // Schedule token refresh 1 minute before expiry
        if (expiresIn > 60) {
            this.scheduleRefresh(expiresIn - 60);
        }
        
        console.log('Session tokens stored in cookies and refresh scheduled');
        
        // Verify the cookies were set
        setTimeout(() => {
            console.log('Verifying cookies set:', {
                access_token: this.getCookie('access_token') ? 'present' : 'missing',
                refresh_token: this.getCookie('refresh_token') ? 'present' : 'missing'
            });
        }, 100);
    }

    // Load tokens from cookies on page load
    loadTokens() {
        this.accessToken = this.getCookie('access_token');
        this.refreshToken = this.getCookie('refresh_token');
        
        if (this.accessToken && this.refreshToken) {
            // Try to verify the access token is still valid
            this.verifyToken().catch(() => {
                // If access token is expired, try to refresh
                this.refreshTokens();
            });
        }
        
        return this.hasValidSession();
    }

    // Check if we have a valid session
    hasValidSession() {
        return !!(this.accessToken && this.refreshToken);
    }

    // Get current access token
    getAccessToken() {
        return this.accessToken;
    }

    // Schedule automatic token refresh
    scheduleRefresh(seconds) {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        
        this.refreshTimeout = setTimeout(() => {
            this.refreshTokens();
        }, seconds * 1000);
    }

    // Refresh tokens using refresh token
    async refreshTokens() {
        if (this.isRefreshing) {
            return this.refreshPromise;
        }
        
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }
        
        this.isRefreshing = true;
        this.refreshPromise = this._performRefresh();
        
        try {
            const result = await this.refreshPromise;
            return result;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    async _performRefresh() {
        try {
            const response = await fetch('/api/refresh-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    refresh_token: this.refreshToken
                })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            
            if (data.success) {
                // Update tokens and cookies
                this.setTokens(data.access_token, data.refresh_token, data.expires_in);
                console.log('Tokens refreshed successfully');
                return data;
            } else {
                throw new Error(data.error || 'Token refresh failed');
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            this.clearSession();
            throw error;
        }
    }

    // Verify access token is valid
    async verifyToken() {
        if (!this.accessToken) {
            throw new Error('No access token');
        }

        const response = await fetch('/api/verify-access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                access_token: this.accessToken
            })
        });

        const data = await response.json();
        
        if (!data.valid) {
            throw new Error(data.error || 'Token invalid');
        }
        
        return data;
    }

    // Make authenticated request with automatic token refresh
    async authenticatedFetch(url, options = {}) {
        if (!this.accessToken) {
            throw new Error('No access token - user not authenticated');
        }

        // Add access token to request
        const authOptions = {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.accessToken}`
            }
        };

        try {
            const response = await fetch(url, authOptions);
            
            // If token expired, try to refresh and retry
            if (response.status === 401) {
                await this.refreshTokens();
                
                // Retry with new token
                authOptions.headers['Authorization'] = `Bearer ${this.accessToken}`;
                return fetch(url, authOptions);
            }
            
            return response;
        } catch (error) {
            console.error('Authenticated fetch error:', error);
            throw error;
        }
    }

    // Logout and clear session
    async logout() {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    access_token: this.accessToken,
                    refresh_token: this.refreshToken
                })
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearSession();
        }
    }

    // Clear all session data
    clearSession() {
        this.accessToken = null;
        this.refreshToken = null;
        
        this.deleteCookie('access_token');
        this.deleteCookie('refresh_token');
        
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
        
        console.log('Session cleared');
    }

    // Get current user info from token
    async getCurrentUser() {
        if (!this.accessToken) {
            return null;
        }

        try {
            const tokenData = await this.verifyToken();
            return {
                username: tokenData.username,
                sessionId: tokenData.session_id
            };
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    }
}

// Global session manager instance
const sessionManager = new SessionManager();

// Auto-load tokens on page load
document.addEventListener('DOMContentLoaded', () => {
    sessionManager.loadTokens();
});

export { sessionManager, SessionManager };
