# database models for cypher
# all the sensitive stuff gets encrypted automatically
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
try:
    from src.database_config import Base
    from src.encryption_manager import get_encryption_manager
except ImportError:
    # when called from migrations or other contexts
    from database_config import Base
    from encryption_manager import get_encryption_manager
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
import json
import logging

logger = logging.getLogger(__name__)

class EncryptedField:
    # magic descriptor that handles encryption/decryption transparently
    # just set the field normally and it gets encrypted behind the scenes
    
    def __init__(self, column_name: str):
        self.column_name = column_name
        self.key_column_name = f"{column_name}_key_id"
    
    def __get__(self, instance, owner):
        # when someone reads the field, decrypt it automatically
        if instance is None:
            return self
        
        encrypted_data = getattr(instance, self.column_name)
        key_id = getattr(instance, self.key_column_name)
        
        if encrypted_data and key_id:
            try:
                encryption_manager = get_encryption_manager()
                return encryption_manager.decrypt_to_string(encrypted_data, key_id)
            except Exception as e:
                logger.error(f"Failed to decrypt {self.column_name}: {e}")
                return None  # better to return None than crash
        return None
    
    def __set__(self, instance, value):
        # when someone sets the field, encrypt it automatically
        if value is None:
            setattr(instance, self.column_name, None)
            setattr(instance, self.key_column_name, None)
            return
        
        try:
            encryption_manager = get_encryption_manager()
            key_id, encrypted_data = encryption_manager.encrypt(value)
            setattr(instance, self.column_name, encrypted_data)
            setattr(instance, self.key_column_name, key_id)
        except Exception as e:
            logger.error(f"Failed to encrypt {self.column_name}: {e}")
            raise  # encryption failure is serious business

class User(Base):
    # main user table - stores OPAQUE records and TOTP secrets encrypted
    
    __tablename__ = 'users'
    
    # basic user info
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(255), unique=True, nullable=False, index=True)  # main identifier
    
    # OPAQUE stuff - this is the zero-knowledge password data
    opaque_record = Column(Text, nullable=True)  # encrypted OPAQUE record
    opaque_record_key_id = Column(String(255), nullable=True)  # which key encrypted it
    
    # 2FA secrets - also encrypted
    totp_secret = Column(Text, nullable=True)
    totp_secret_key_id = Column(String(255), nullable=True)
    totp_backup_codes = Column(Text, nullable=True)  # JSON array, encrypted
    totp_backup_codes_key_id = Column(String(255), nullable=True)
    
    # account status flags
    is_active = Column(Boolean, default=True, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)  # TODO: implement email verification
    totp_enabled = Column(Boolean, default=False, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)  # for brute force protection
    locked_until = Column(DateTime(timezone=True), nullable=True)  # temporary lockout
    
    # timestamps for tracking stuff
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)  # auto-updates
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # for compliance
    
    # these make encryption/decryption automatic when you access the fields
    encrypted_opaque_record = EncryptedField('opaque_record')
    encrypted_totp_secret = EncryptedField('totp_secret')
    encrypted_totp_backup_codes = EncryptedField('totp_backup_codes')
    
    # database indexes to make queries fast
    __table_args__ = (
        Index('idx_users_username_active', 'username', 'is_active'),  # login queries
        Index('idx_users_created_at', 'created_at'),  # for user analytics
        Index('idx_users_last_login', 'last_login_at'),  # activity tracking
    )
    
    def set_opaque_record(self, record_data: str):
        # store the OPAQUE record (gets encrypted automatically)
        self.encrypted_opaque_record = record_data
    
    def get_opaque_record(self) -> Optional[str]:
        # get the OPAQUE record (gets decrypted automatically)
        return self.encrypted_opaque_record
    
    def set_totp_secret(self, secret: str):
        # store the TOTP secret (encrypted)
        self.encrypted_totp_secret = secret
    
    def get_totp_secret(self) -> Optional[str]:
        # get the TOTP secret (decrypted)
        return self.encrypted_totp_secret
    
    def set_totp_backup_codes(self, codes: list):
        # store backup codes as encrypted JSON
        self.encrypted_totp_backup_codes = json.dumps(codes)
    
    def get_totp_backup_codes(self) -> list:
        # get backup codes (decrypted and parsed from JSON)
        codes_json = self.encrypted_totp_backup_codes
        return json.loads(codes_json) if codes_json else []
    
    def is_locked(self) -> bool:
        # check if account is temporarily locked due to failed attempts
        if self.locked_until:
            return datetime.utcnow() < self.locked_until.replace(tzinfo=None)
        return False
    
    def to_dict(self, include_sensitive: bool = False) -> Dict[str, Any]:
        # serialize user data for API responses
        # sensitive stuff only included if explicitly requested
        data = {
            'id': str(self.id),
            'username': self.username,
            'is_active': self.is_active,
            'email_verified': self.email_verified,
            'totp_enabled': self.totp_enabled,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'is_locked': self.is_locked()
        }
        
        if include_sensitive:
            data.update({
                'failed_login_attempts': self.failed_login_attempts,
                'locked_until': self.locked_until.isoformat() if self.locked_until else None,
                'password_changed_at': self.password_changed_at.isoformat() if self.password_changed_at else None
            })
        
        return data

class UserSession(Base):
    # user sessions table - persists across server restarts
    # redis handles active sessions, this is for persistence
    
    __tablename__ = 'user_sessions'
    
    # session info
    session_id = Column(String(255), primary_key=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # session data gets encrypted too
    session_data = Column(Text, nullable=True)
    session_data_key_id = Column(String(255), nullable=True)
    
    # tracking metadata for security
    ip_address = Column(String(45), nullable=True)  # IPv6 support
    user_agent = Column(Text, nullable=True)  # browser info
    device_fingerprint = Column(String(255), nullable=True)  # device identification
    
    # status flags
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    # when stuff happened
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_accessed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # for activity tracking
    
    # automatic encryption for session data
    encrypted_session_data = EncryptedField('session_data')
    
    # speed up common queries
    __table_args__ = (
        Index('idx_sessions_user_active', 'user_id', 'is_active'),  # find user sessions
        Index('idx_sessions_expires', 'expires_at'),  # cleanup expired sessions
        Index('idx_sessions_created', 'created_at'),  # session analytics
    )
    
    def set_session_data(self, data: Dict[str, Any]):
        # store session data as encrypted JSON
        self.encrypted_session_data = json.dumps(data)
    
    def get_session_data(self) -> Dict[str, Any]:
        # get session data (decrypted and parsed)
        data_json = self.encrypted_session_data
        return json.loads(data_json) if data_json else {}
    
    def is_expired(self) -> bool:
        # check if this session has timed out
        return datetime.utcnow() > self.expires_at.replace(tzinfo=None)  # FIXME: this was backwards!
    
    def to_dict(self) -> Dict[str, Any]:
        # serialize for API responses
        return {
            'session_id': self.session_id,
            'user_id': str(self.user_id),
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'device_fingerprint': self.device_fingerprint,
            'is_active': self.is_active,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_accessed_at': self.last_accessed_at.isoformat() if self.last_accessed_at else None,
            'is_expired': self.is_expired()
        }

class RefreshToken(Base):
    # refresh tokens for PASETO rotation
    # store these persistently so they survive server restarts
    
    __tablename__ = 'refresh_tokens'
    
    # token identifiers
    token_id = Column(String(255), primary_key=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(String(255), nullable=False, index=True)  # link to session
    
    # token storage (encrypted)
    token_hash = Column(String(255), nullable=False)  # we hash the actual token
    token_data = Column(Text, nullable=True)  # metadata gets encrypted
    token_data_key_id = Column(String(255), nullable=True)
    
    # timing info
    issued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)  # tokens expire
    used_at = Column(DateTime(timezone=True), nullable=True)  # when it was last used
    
    # token state
    is_active = Column(Boolean, default=True, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)  # manually revoked
    
    # automatic encryption for token metadata
    encrypted_token_data = EncryptedField('token_data')
    
    # indexes for token lookups
    __table_args__ = (
        Index('idx_refresh_tokens_user_active', 'user_id', 'is_active'),  # user tokens
        Index('idx_refresh_tokens_session', 'session_id'),  # session tokens
        Index('idx_refresh_tokens_expires', 'expires_at'),  # cleanup expired
        Index('idx_refresh_tokens_hash', 'token_hash'),  # fast token validation
    )
    
    def set_token_data(self, data: Dict[str, Any]):
        # store token metadata as encrypted JSON
        self.encrypted_token_data = json.dumps(data)
    
    def get_token_data(self) -> Dict[str, Any]:
        # get token metadata (decrypted)
        data_json = self.encrypted_token_data
        return json.loads(data_json) if data_json else {}
    
    def is_expired(self) -> bool:
        """Check if token is expired."""
        return datetime.utcnow() > self.expires_at.replace(tzinfo=None)
    
    def is_valid(self) -> bool:
        # check if token is still good to use
        return self.is_active and not self.is_revoked and not self.is_expired()
    
    def revoke(self):
        # mark token as unusable (for logout, security breach, etc)
        self.is_revoked = True
        self.is_active = False
    
    def to_dict(self) -> Dict[str, Any]:
        # serialize for API responses
        return {
            'token_id': self.token_id,
            'user_id': str(self.user_id),
            'session_id': self.session_id,
            'issued_at': self.issued_at.isoformat() if self.issued_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'used_at': self.used_at.isoformat() if self.used_at else None,
            'is_active': self.is_active,
            'is_revoked': self.is_revoked,
            'is_valid': self.is_valid()
        }

class AuditLog(Base):
    # security event logging for compliance (SOC2, GDPR, etc)
    # everything gets logged here with details encrypted
    
    __tablename__ = 'audit_logs'
    
    # unique log entry
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # what happened
    event_type = Column(String(100), nullable=False, index=True)  # 'login_failed', 'session_created', etc
    event_category = Column(String(50), nullable=False, index=True)  # AUTH, SESSION, ADMIN, etc
    severity = Column(String(20), nullable=False)  # INFO, WARN, ERROR, CRITICAL
    
    # context info (who, where, when)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # which user (if any)
    session_id = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)  # where did this come from
    user_agent = Column(Text, nullable=True)  # browser/client info
    
    # detailed info (encrypted because it might contain sensitive data)
    event_details = Column(Text, nullable=True)
    event_details_key_id = Column(String(255), nullable=True)
    
    # outcome info
    success = Column(Boolean, nullable=True)  # did it work?
    error_code = Column(String(50), nullable=True)  # error codes for failures
    
    # when it happened
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # automatic encryption for sensitive event details
    encrypted_event_details = EncryptedField('event_details')
    
    # indexes for compliance reporting and security analysis
    __table_args__ = (
        Index('idx_audit_logs_timestamp', 'timestamp'),  # chronological queries
        Index('idx_audit_logs_user_time', 'user_id', 'timestamp'),  # user activity reports
        Index('idx_audit_logs_event_type', 'event_type', 'timestamp'),  # event type analysis
        Index('idx_audit_logs_category_severity', 'event_category', 'severity'),  # security alerts
        Index('idx_audit_logs_ip_time', 'ip_address', 'timestamp'),  # threat analysis
    )
    
    def set_event_details(self, details: Dict[str, Any]):
        # store event details as encrypted JSON
        self.encrypted_event_details = json.dumps(details)
    
    def get_event_details(self) -> Dict[str, Any]:
        # get event details (decrypted)
        details_json = self.encrypted_event_details
        return json.loads(details_json) if details_json else {}
    
    def to_dict(self) -> Dict[str, Any]:
        # serialize for compliance reports and API responses
        return {
            'id': str(self.id),
            'event_type': self.event_type,
            'event_category': self.event_category,
            'severity': self.severity,
            'user_id': str(self.user_id) if self.user_id else None,
            'session_id': self.session_id,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'event_details': self.get_event_details(),
            'success': self.success,
            'error_code': self.error_code,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }
