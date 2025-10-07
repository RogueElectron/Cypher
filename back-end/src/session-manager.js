class SessionManager {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.refreshTimeout = null;
        this.isRefreshing = false;
        this.refreshPromise = null;
        
        // handles multiple tabs fighting over tokens
        this.setupStorageSync();
    }
    
    setupStorageSync() {
        // listen for when other tabs mess with tokens
        window.addEventListener('storage', (event) => {
            if (event.key === 'refresh_token') {
                this.refreshToken = event.newValue;
            } else if (event.key === 'token_sync') {
                // some other tab did the work for us
                const syncData = JSON.parse(event.newValue || '{}');
                if (syncData.action === 'update') {
                    this.accessToken = this.getCookie('access_token');
                    this.refreshToken = localStorage.getItem('refresh_token');
                    
                    // stop our timer since someone else already refreshed
                    if (this.refreshTimeout) {
                        clearTimeout(this.refreshTimeout);
                    }
                    // random delay to avoid everyone refreshing at once
                    const ROTATION_INTERVAL = 90;
                    const jitter = Math.random() * 10; // TODO: maybe make this configurable?
                    this.scheduleRefresh(ROTATION_INTERVAL + jitter);
                } else if (syncData.action === 'clear') {
                    this.clearSession();
                }
            }
        });
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
        
        // access token goes in cookie so it gets sent automatically
        this.setCookie('access_token', accessToken, expiresIn);
        
        // refresh token stays local - don't want it sent with every request
        localStorage.setItem('refresh_token', refreshToken);
        
        // tell other tabs we got new tokens
        localStorage.setItem('token_sync', JSON.stringify({
            action: 'update',
            timestamp: Date.now()
        }));
        
        // remember to fix this - hardcoded 90 seconds
        const ROTATION_INTERVAL = 90;
        const jitter = Math.random() * 10; // random delay so tabs don't sync up
        this.scheduleRefresh(ROTATION_INTERVAL + jitter);
    }

    loadTokens() {
        this.accessToken = this.getCookie('access_token');
        this.refreshToken = localStorage.getItem('refresh_token');
        
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
        
        // try to be the tab that does the refresh
        const lockAcquired = this.acquireRefreshLock();
        if (!lockAcquired) {
            // someone else is handling it, just wait
            return new Promise((resolve) => {
                const handleTokenSync = (event) => {
                    if (event.key === 'token_sync') {
                        const syncData = JSON.parse(event.newValue || '{}');
                        if (syncData.action === 'update') {
                            // other tab finished, grab the new tokens
                            this.accessToken = this.getCookie('access_token');
                            this.refreshToken = localStorage.getItem('refresh_token');
                            window.removeEventListener('storage', handleTokenSync);
                            resolve();
                        }
                    }
                };
                
                window.addEventListener('storage', handleTokenSync);
                
                // give up after 10 seconds in case something breaks
                setTimeout(() => {
                    window.removeEventListener('storage', handleTokenSync);
                    resolve();
                }, 10000);
            });
        }
        
        this.isRefreshing = true;
        this.refreshPromise = this._performRefresh();
        
        try {
            const result = await this.refreshPromise;
            return result;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
            this.releaseRefreshLock();
        }
    }
    
    acquireRefreshLock() {
        const now = Date.now();
        const tabId = Math.random().toString(36);
        
        // each tab gets a unique lock value
        const lockValue = JSON.stringify({
            timestamp: now,
            tabId: tabId
        });
        
        // try to claim the lock
        localStorage.setItem('refresh_lock', lockValue);
        
        // make sure we actually got it (race conditions are fun)
        const actualLock = localStorage.getItem('refresh_lock');
        if (actualLock !== lockValue) {
            // someone else won, but maybe their lock is old?
            try {
                const lockData = JSON.parse(actualLock);
                if (now - lockData.timestamp > 10000) {
                    // lock is stale, steal it
                    localStorage.setItem('refresh_lock', lockValue);
                    return localStorage.getItem('refresh_lock') === lockValue;
                }
            } catch (e) {
                // corrupted data, just take it
                localStorage.setItem('refresh_lock', lockValue);
                return localStorage.getItem('refresh_lock') === lockValue;
            }
            return false; // they have a valid lock
        }
        
        return true; // we got it!
    }
    
    releaseRefreshLock() {
        localStorage.removeItem('refresh_lock');
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

    // wrapper for fetch that handles expired tokens
    async authenticatedFetch(url, options = {}) {
        if (!this.accessToken) {
            throw new Error('No access token - user not authenticated');
        }

        // flask wants tokens in the body, not headers
        const body = options.body ? JSON.parse(options.body) : {};
        body.access_token = this.accessToken;

        const authOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: JSON.stringify(body)
        };

        try {
            const response = await fetch(url, authOptions);
            
            if (response.status === 401) {
                // token expired, get a new one and try again
                await this.refreshTokens();
                const newBody = JSON.parse(authOptions.body);
                newBody.access_token = this.accessToken;
                authOptions.body = JSON.stringify(newBody);
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
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('refresh_lock'); // cleanup any locks we might have had
        
        // tell other tabs we're logging out
        localStorage.setItem('token_sync', JSON.stringify({
            action: 'clear',
            timestamp: Date.now()
        }));
        
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

// start loading tokens as soon as the page is ready
document.addEventListener('DOMContentLoaded', () => {
    sessionManager.loadTokens();
});

export { sessionManager, SessionManager };
