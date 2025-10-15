# redis stuff for fast session storage and caching
# way faster than hitting postgres for every request
import json
import time
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Union
from src.database_config import get_redis
from src.encryption_manager import get_encryption_manager
import logging

logger = logging.getLogger(__name__)

class RedisManager:
    # base redis operations class
    # handles all the common redis patterns we use
    # sessions, tokens, rate limiting, device tracking, etc
    
    def __init__(self):
        self.redis = None
        self.key_prefix = "cypher:"  # namespace all our keys
        self.default_ttl = 3600  # 1 hour seems reasonable for most stuff
    
    def init_redis(self):
        # connect to redis when the app starts up
        self.redis = get_redis()
        logger.info("Redis manager initialized")
    
    def _get_key(self, category: str, identifier: str) -> str:
        # make a namespaced key like "cypher:session:abc123"
        return f"{self.key_prefix}{category}:{identifier}"
    
    def _encrypt_value(self, value: Any) -> Dict[str, str]:
        # encrypt stuff before storing in redis
        if value is None:
            return {"encrypted": False, "data": None}  # nothing to encrypt
        
        try:
            json_str = json.dumps(value)
            encryption_manager = get_encryption_manager()
            key_id, encrypted_data = encryption_manager.encrypt(json_str)
            
            return {
                "encrypted": True,
                "key_id": key_id,
                "data": encrypted_data
            }
        except Exception as e:
            logger.error(f"Failed to encrypt Redis value: {e}")
            raise
    
    def _decrypt_value(self, redis_value: str) -> Any:
        # decrypt stuff we pulled from redis
        try:
            parsed = json.loads(redis_value)
            
            if not parsed.get("encrypted", False):
                return parsed.get("data")  # wasn't encrypted
            
            key_id = parsed.get("key_id")
            encrypted_data = parsed.get("data")
            
            if not key_id or not encrypted_data:
                return None  # malformed data
            
            encryption_manager = get_encryption_manager()
            decrypted_json = encryption_manager.decrypt_to_string(encrypted_data, key_id)
            
            return json.loads(decrypted_json)
            
        except Exception as e:
            logger.error(f"Failed to decrypt Redis value: {e}")
            return None  # better than crashing
    
    def _set_encrypted(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        # store encrypted data in redis with optional expiration
        try:
            encrypted_value = self._encrypt_value(value)
            serialized = json.dumps(encrypted_value)
            
            if ttl:
                return self.redis.setex(key, ttl, serialized)  # with expiration
            else:
                return self.redis.set(key, serialized)  # no expiration
                
        except Exception as e:
            logger.error(f"Failed to set encrypted Redis value for key {key}: {e}")
            return False
    
    def _get_encrypted(self, key: str) -> Any:
        # get and decrypt data from redis
        try:
            value = self.redis.get(key)
            if value is None:
                return None  # key doesn't exist
            
            return self._decrypt_value(value)
            
        except Exception as e:
            logger.error(f"Failed to get encrypted Redis value for key {key}: {e}")
            return None

class SessionManager(RedisManager):
    # handles user sessions in redis for fast access
    
    def __init__(self):
        super().__init__()
        self.session_ttl = 3600  # sessions last 1 hour
        self.refresh_token_ttl = 7 * 24 * 3600  # refresh tokens last 7 days
    
    def create_session(self, user_id: str, session_data: Dict[str, Any], 
                      ttl: Optional[int] = None) -> str:
        # create a new session and store it in redis
        session_id = secrets.token_urlsafe(32)  # random session ID
        
        session_info = {
            "user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
            "last_accessed": datetime.utcnow().isoformat(),
            "data": session_data
        }
        
        key = self._get_key("session", session_id)
        ttl = ttl or self.session_ttl  # default to 1 hour
        
        if self._set_encrypted(key, session_info, ttl):
            # keep track of all sessions for this user
            self._add_user_session(user_id, session_id, ttl)
            logger.info(f"Created session {session_id} for user {user_id}")
            return session_id
        
        raise RuntimeError("Failed to create session")  # this shouldn't happen
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        # get session data from redis
        key = self._get_key("session", session_id)
        session_info = self._get_encrypted(key)
        
        if session_info:
            # update the last access time and refresh TTL
            session_info["last_accessed"] = datetime.utcnow().isoformat()
            self._set_encrypted(key, session_info, self.session_ttl)
            
        return session_info
    
    def update_session(self, session_id: str, session_data: Dict[str, Any]) -> bool:
        # update existing session with new data
        session_info = self.get_session(session_id)
        if not session_info:
            return False  # session doesn't exist
        
        session_info["data"].update(session_data)  # merge in new data
        session_info["last_accessed"] = datetime.utcnow().isoformat()
        
        key = self._get_key("session", session_id)
        return self._set_encrypted(key, session_info, self.session_ttl)
    
    def delete_session(self, session_id: str) -> bool:
        # remove a session (logout, timeout, etc)
        session_info = self.get_session(session_id)
        if session_info:
            user_id = session_info.get("user_id")
            if user_id:
                self._remove_user_session(user_id, session_id)  # cleanup user tracking
        
        key = self._get_key("session", session_id)
        result = self.redis.delete(key) > 0
        
        if result:
            logger.info(f"Deleted session {session_id}")
        
        return result
    
    def _add_user_session(self, user_id: str, session_id: str, ttl: int):
        # keep track of all sessions for a user (for mass logout, etc)
        user_sessions_key = self._get_key("user_sessions", user_id)
        self.redis.sadd(user_sessions_key, session_id)  # add to set
        self.redis.expire(user_sessions_key, ttl)  # expire with sessions
    
    def _remove_user_session(self, user_id: str, session_id: str):
        # remove session from user's session list
        user_sessions_key = self._get_key("user_sessions", user_id)
        self.redis.srem(user_sessions_key, session_id)
    
    def get_user_sessions(self, user_id: str) -> List[str]:
        # get all session IDs for a user
        user_sessions_key = self._get_key("user_sessions", user_id)
        sessions = self.redis.smembers(user_sessions_key)
        return list(sessions) if sessions else []
    
    def delete_user_sessions(self, user_id: str) -> int:
        # kill all sessions for a user (security breach, account lock, etc)
        sessions = self.get_user_sessions(user_id)
        deleted_count = 0
        
        for session_id in sessions:
            if self.delete_session(session_id):
                deleted_count += 1
        
        # cleanup the user sessions tracking set
        user_sessions_key = self._get_key("user_sessions", user_id)
        self.redis.delete(user_sessions_key)
        
        logger.info(f"Deleted {deleted_count} sessions for user {user_id}")
        return deleted_count

class TokenManager(RedisManager):
    # handles token blacklisting and caching
    
    def __init__(self):
        super().__init__()
        self.blacklist_ttl = 24 * 3600  # keep blacklisted tokens for 24 hours
    
    def blacklist_token(self, token: str, ttl: Optional[int] = None) -> bool:
        # add a token to the blacklist (for logout, revocation, etc)
        token_hash = hashlib.sha256(token.encode()).hexdigest()  # hash for privacy
        key = self._get_key("blacklist", token_hash)
        ttl = ttl or self.blacklist_ttl
        
        blacklist_info = {
            "blacklisted_at": datetime.utcnow().isoformat(),
            "reason": "logout"  # could be 'revoked', 'compromise', etc
        }
        
        result = self._set_encrypted(key, blacklist_info, ttl)
        if result:
            logger.info(f"Blacklisted token hash: {token_hash[:16]}...")  # only log partial hash
        
        return result
    
    def is_token_blacklisted(self, token: str) -> bool:
        # check if a token has been blacklisted
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        key = self._get_key("blacklist", token_hash)
        
        return self.redis.exists(key) > 0
    
    def cache_refresh_token(self, user_id: str, token_id: str, token_data: Dict[str, Any], 
                           ttl: Optional[int] = None) -> bool:
        # cache refresh token data for fast lookup
        key = self._get_key("refresh_token", token_id)
        ttl = ttl or (7 * 24 * 3600)  # 7 days default
        
        cached_data = {
            "user_id": user_id,
            "token_data": token_data,
            "cached_at": datetime.utcnow().isoformat()
        }
        
        return self._set_encrypted(key, cached_data, ttl)
    
    def get_cached_refresh_token(self, token_id: str) -> Optional[Dict[str, Any]]:
        # get cached refresh token info
        key = self._get_key("refresh_token", token_id)
        return self._get_encrypted(key)
    
    def revoke_refresh_token(self, token_id: str) -> bool:
        # remove refresh token from cache (revoke it)
        key = self._get_key("refresh_token", token_id)
        result = self.redis.delete(key) > 0
        
        if result:
            logger.info(f"Revoked cached refresh token: {token_id}")
        
        return result

class RateLimiter(RedisManager):
    # sliding window rate limiting using redis sorted sets
    
    def __init__(self):
        super().__init__()
    
    def check_rate_limit(self, identifier: str, limit: int, window_seconds: int, 
                        category: str = "general") -> Dict[str, Any]:
        # sliding window rate limiting - tracks requests over time
        # returns info about whether request is allowed
        key = self._get_key(f"ratelimit:{category}", identifier)
        current_time = int(time.time())
        
        # use pipeline for atomic operations
        pipe = self.redis.pipeline()
        
        # cleanup old entries outside the window
        pipe.zremrangebyscore(key, 0, current_time - window_seconds)
        
        # count current requests in the window
        pipe.zcard(key)
        
        # add this request to the window
        pipe.zadd(key, {str(current_time): current_time})
        
        # make sure the key expires eventually
        pipe.expire(key, window_seconds)
        
        results = pipe.execute()
        current_count = results[1] + 1  # +1 for the request we just added
        
        allowed = current_count <= limit
        remaining = max(0, limit - current_count)
        reset_time = current_time + window_seconds
        
        rate_limit_info = {
            'allowed': allowed,
            'count': current_count,
            'remaining': remaining,
            'limit': limit,
            'reset_time': reset_time,
            'window_seconds': window_seconds
        }
        
        if not allowed:
            logger.warning(f"Rate limit exceeded for {category}:{identifier} - {current_count}/{limit}")
        
        return rate_limit_info
    
    def reset_rate_limit(self, identifier: str, category: str = "general") -> bool:
        # clear rate limit for an identifier (admin override, etc)
        key = self._get_key(f"ratelimit:{category}", identifier)
        result = self.redis.delete(key) > 0
        
        if result:
            logger.info(f"Reset rate limit for {category}:{identifier}")
        
        return result

class DeviceTracker(RedisManager):
    # tracks user devices for security analysis
    
    def __init__(self):
        super().__init__()
        self.device_ttl = 30 * 24 * 3600  # remember devices for 30 days
    
    def register_device(self, user_id: str, device_fingerprint: str, 
                       device_info: Dict[str, Any]) -> bool:
        # record device info for security monitoring
        key = self._get_key("device", f"{user_id}:{device_fingerprint}")
        
        device_data = {
            "user_id": user_id,
            "device_fingerprint": device_fingerprint,
            "first_seen": device_info.get("first_seen", datetime.utcnow().isoformat()),
            "last_seen": datetime.utcnow().isoformat(),
            "ip_addresses": device_info.get("ip_addresses", []),
            "user_agents": device_info.get("user_agents", []),
            "trusted": device_info.get("trusted", False),  # manual trust flag
            "login_count": device_info.get("login_count", 0) + 1  # increment usage
        }
        
        return self._set_encrypted(key, device_data, self.device_ttl)
    
    def get_device_info(self, user_id: str, device_fingerprint: str) -> Optional[Dict[str, Any]]:
        # get stored device information
        key = self._get_key("device", f"{user_id}:{device_fingerprint}")
        return self._get_encrypted(key)
    
    def is_trusted_device(self, user_id: str, device_fingerprint: str) -> bool:
        # check if we trust this device (for skipping 2FA, etc)
        device_info = self.get_device_info(user_id, device_fingerprint)
        return device_info.get("trusted", False) if device_info else False
    
    def get_user_devices(self, user_id: str) -> List[Dict[str, Any]]:
        # get all known devices for a user
        pattern = self._get_key("device", f"{user_id}:*")
        devices = []
        
        for key in self.redis.scan_iter(match=pattern):
            device_data = self._get_encrypted(key)
            if device_data:
                devices.append(device_data)
        
        return devices

# global manager instances - create once, use everywhere
session_manager = SessionManager()
token_manager = TokenManager()
rate_limiter = RateLimiter()
device_tracker = DeviceTracker()

def init_redis_managers():
    # initialize all the redis managers on app startup
    managers = [session_manager, token_manager, rate_limiter, device_tracker]
    
    for manager in managers:
        manager.init_redis()
    
    logger.info("All Redis managers initialized")

def get_session_manager() -> SessionManager:
    # get the global session manager
    return session_manager

def get_token_manager() -> TokenManager:
    # get the global token manager
    return token_manager

def get_rate_limiter() -> RateLimiter:
    # get the global rate limiter
    return rate_limiter

def get_device_tracker() -> DeviceTracker:
    # get the global device tracker
    return device_tracker
