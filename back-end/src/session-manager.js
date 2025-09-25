class SessionManager {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.refreshTimeout = null;
        this.isRefreshing = false;
        this.refreshPromise = null;
    }

    setCookie(name, value, maxAge) {
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        const cookie = `${name}=${value}; Max-Age=${maxAge}; SameSite=Lax; Path=/${secure}`;
        document.cookie = cookie;
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

    setTokens(accessToken, refreshToken, expiresIn) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        
        this.setCookie('access_token', accessToken, expiresIn);
        this.setCookie('refresh_token', refreshToken, 2592000);
        
        // auto refresh 1 minute before expiry
        if (expiresIn > 60) {
            this.scheduleRefresh(expiresIn - 60);
        }
    }

    loadTokens() {
        this.accessToken = this.getCookie('access_token');
        this.refreshToken = this.getCookie('refresh_token');
        
        if (this.accessToken && this.refreshToken) {
            this.verifyToken().catch(() => {
                this.refreshTokens();
            });
        }
        
        return this.hasValidSession();
    }

    hasValidSession() {
        return !!(this.accessToken && this.refreshToken);
    }

    getAccessToken() {
        return this.accessToken;
    }

    scheduleRefresh(seconds) {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        
        this.refreshTimeout = setTimeout(() => {
            this.refreshTokens();
        }, seconds * 1000);
    }

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
                this.setTokens(data.access_token, data.refresh_token, data.expires_in);
                return data;
            } else {
                throw new Error(data.error || 'Token refresh failed');
            }
        } catch (error) {
            this.clearSession();
            throw error;
        }
    }
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

    // make requests with auto token refresh if needed
    async authenticatedFetch(url, options = {}) {
        if (!this.accessToken) {
            throw new Error('No access token - user not authenticated');
        }

        const authOptions = {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.accessToken}`
            }
        };

        try {
            const response = await fetch(url, authOptions);
            
            if (response.status === 401) {
                await this.refreshTokens();
                authOptions.headers['Authorization'] = `Bearer ${this.accessToken}`;
                return fetch(url, authOptions);
            }
            
            return response;
        } catch (error) {
            throw error;
        }
    }
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
        } finally {
            this.clearSession();
        }
    }

    clearSession() {
        this.accessToken = null;
        this.refreshToken = null;
        
        this.deleteCookie('access_token');
        this.deleteCookie('refresh_token');
        
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
    }

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
            return null;
        }
    }
}

const sessionManager = new SessionManager();

document.addEventListener('DOMContentLoaded', () => {
    sessionManager.loadTokens();
});

export { sessionManager, SessionManager };
