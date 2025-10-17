# handles all the encryption stuff for the database
# keys rotate automatically so we don't get stuck with old keys forever
import os
import json
import base64
import secrets
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import logging
from typing import Dict, Optional, Tuple, Union
from dotenv import load_dotenv
from pathlib import Path

# Load .env from project root (two levels up from this file)
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)
logger = logging.getLogger(__name__)

# TODO: look into hardware security modules for production

class EncryptionKey:
    # wrapper for a single encryption key with its metadata
    
    def __init__(self, key_id: str, key_data: bytes, created_at: datetime, is_active: bool = True):
        self.key_id = key_id
        self.key_data = key_data
        self.created_at = created_at
        self.is_active = is_active
        self.fernet = Fernet(key_data)
    
    def to_dict(self) -> dict:
        # save metadata only, never the actual key data
        return {
            'key_id': self.key_id,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }
    
    @classmethod
    def from_dict(cls, data: dict, key_data: bytes):
        # reconstruct key object from saved metadata
        return cls(
            key_id=data['key_id'],
            key_data=key_data,
            created_at=datetime.fromisoformat(data['created_at']),
            is_active=data['is_active']
        )

class EncryptionManager:
    # main encryption handler
    # rotates keys automatically based on age (90 days) or usage (1M ops)
    # keeps old keys around so we can still decrypt old data
    
    def __init__(self, master_password: Optional[str] = None):
        self.master_password = master_password or os.getenv('MASTER_ENCRYPTION_PASSWORD')
        if not self.master_password:
            raise ValueError("Master encryption password required")  # don't forget to set this in .env!
        
        self.keys: Dict[str, EncryptionKey] = {}
        self.active_key_id: Optional[str] = None
        self.key_rotation_days = int(os.getenv('KEY_ROTATION_DAYS', '90'))  # rotate every 90 days
        self.max_encryption_operations = int(os.getenv('MAX_ENCRYPTION_OPS', '1000000'))  # or after 1M operations
        self.encryption_count = 0  # track how many times we've encrypted stuff
        
        # where we store the encrypted keys - use relative path from project root
        default_path = os.path.join(os.path.dirname(__file__), '..', '..', '.keys')
        self.key_store_path = os.getenv('KEY_STORE_PATH', os.path.abspath(default_path))
        os.makedirs(self.key_store_path, mode=0o700, exist_ok=True)  # 700 = owner only
        
        self._load_or_create_keys()
    
    def _derive_master_key(self, salt: bytes) -> bytes:
        # turn the master password into an actual encryption key
        # PBKDF2 with 100k iterations - slow on purpose to prevent brute force
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,  # might be overkill but better safe than sorry
            backend=default_backend()
        )
        return base64.urlsafe_b64encode(kdf.derive(self.master_password.encode()))
    
    def _encrypt_key_data(self, key_data: bytes, salt: bytes) -> bytes:
        # encrypt the encryption key with the master key (inception vibes)
        master_key = self._derive_master_key(salt)
        fernet = Fernet(master_key)
        return fernet.encrypt(key_data)
    
    def _decrypt_key_data(self, encrypted_data: bytes, salt: bytes) -> bytes:
        # decrypt an encrypted key using the master key
        master_key = self._derive_master_key(salt)
        fernet = Fernet(master_key)
        return fernet.decrypt(encrypted_data)
    
    def _generate_key_id(self) -> str:
        # make a unique ID for this key - timestamp + random hex
        return f"key_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(8)}"
    
    def _create_new_key(self) -> EncryptionKey:
        # generate a fresh encryption key
        key_id = self._generate_key_id()
        key_data = Fernet.generate_key()
        created_at = datetime.utcnow()
        
        return EncryptionKey(key_id, key_data, created_at)
    
    def _save_keys(self):
        # write all keys to disk (encrypted of course)
        try:
            salt = secrets.token_bytes(32)  # fresh salt each time we save
            
            # bundle everything up for storage
            key_store = {
                'salt': base64.b64encode(salt).decode(),
                'keys': {}
            }
            
            for key_id, key in self.keys.items():
                encrypted_key_data = self._encrypt_key_data(key.key_data, salt)
                key_store['keys'][key_id] = {
                    'encrypted_data': base64.b64encode(encrypted_key_data).decode(),
                    'metadata': key.to_dict()
                }
            
            key_store['active_key_id'] = self.active_key_id
            key_store['encryption_count'] = self.encryption_count
            
            # atomic write - tmp file first then rename (safer)
            temp_path = os.path.join(self.key_store_path, 'keys.json.tmp')
            final_path = os.path.join(self.key_store_path, 'keys.json')
            
            # create file with restricted permissions
            fd = os.open(temp_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w') as f:
                json.dump(key_store, f, indent=2)
            
            os.rename(temp_path, final_path)
            logger.info(f"Saved {len(self.keys)} encryption keys to disk")
            
        except Exception as e:
            logger.error(f"Failed to save encryption keys: {e}")
            raise
    
    def _load_keys(self) -> bool:
        # try to load existing keys from disk
        key_file = os.path.join(self.key_store_path, 'keys.json')
        
        if not os.path.exists(key_file):
            return False  # no keys yet, first run probably
        
        try:
            with open(key_file, 'r') as f:
                key_store = json.load(f)
            
            salt = base64.b64decode(key_store['salt'])
            
            for key_id, key_data in key_store['keys'].items():
                encrypted_data = base64.b64decode(key_data['encrypted_data'])
                decrypted_key = self._decrypt_key_data(encrypted_data, salt)
                
                key_obj = EncryptionKey.from_dict(key_data['metadata'], decrypted_key)
                self.keys[key_id] = key_obj
            
            self.active_key_id = key_store.get('active_key_id')
            self.encryption_count = key_store.get('encryption_count', 0)
            
            logger.info(f"Loaded {len(self.keys)} encryption keys from disk")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load encryption keys: {type(e).__name__}: {str(e) or 'Invalid key file or wrong master password'}")
            return False
    
    def _load_or_create_keys(self):
        # load keys if they exist, otherwise make a new one
        if not self._load_keys():
            # first time setup - generate initial key
            initial_key = self._create_new_key()
            self.keys[initial_key.key_id] = initial_key
            self.active_key_id = initial_key.key_id
            self._save_keys()
            logger.info("Created initial encryption key")
    
    def _should_rotate_key(self) -> bool:
        # check if we need to rotate to a new key
        if not self.active_key_id or self.active_key_id not in self.keys:
            return True
        
        active_key = self.keys[self.active_key_id]
        
        # rotate if key is too old
        age = datetime.utcnow() - active_key.created_at
        if age > timedelta(days=self.key_rotation_days):
            logger.info(f"Key rotation needed: key age {age.days} days")
            return True
        
        # or if we've used it too many times
        if self.encryption_count >= self.max_encryption_operations:
            logger.info(f"Key rotation needed: {self.encryption_count} operations")
            return True
        
        return False
    
    def rotate_key(self) -> str:
        # switch to a new encryption key
        logger.info("Starting key rotation")
        
        # Create new key
        new_key = self._create_new_key()
        self.keys[new_key.key_id] = new_key
        
        # old key becomes inactive but we keep it around for decryption
        if self.active_key_id and self.active_key_id in self.keys:
            self.keys[self.active_key_id].is_active = False
        
        # switch to the new key and reset counter
        self.active_key_id = new_key.key_id
        self.encryption_count = 0
        
        self._save_keys()
        logger.info(f"Key rotation completed. New key: {new_key.key_id}")
        
        return new_key.key_id
    
    def encrypt(self, data: Union[str, bytes], key_id: Optional[str] = None) -> Tuple[str, str]:
        # main encryption function - returns (key_id, encrypted_data)
        # automatically rotates keys if needed
        if isinstance(data, str):
            data = data.encode('utf-8')
        
        # check if we need to rotate before encrypting
        if self._should_rotate_key():
            self.rotate_key()  # this might take a moment
        
        # figure out which key to use
        if key_id and key_id in self.keys:
            encryption_key = self.keys[key_id]  # use specific key
        elif self.active_key_id and self.active_key_id in self.keys:
            encryption_key = self.keys[self.active_key_id]  # use current active key
        else:
            raise ValueError("No encryption key available")  # this shouldn't happen
        
        # do the actual encryption
        encrypted_data = encryption_key.fernet.encrypt(data)
        encrypted_b64 = base64.b64encode(encrypted_data).decode('ascii')
        
        self.encryption_count += 1  # track usage for rotation
        
        # save to disk every 1000 operations (don't want to lose the count)
        if self.encryption_count % 1000 == 0:
            self._save_keys()
        
        return encryption_key.key_id, encrypted_b64
    
    def decrypt(self, encrypted_data_b64: str, key_id: str) -> bytes:
        # decrypt data using the key that was used to encrypt it
        # this is why we keep old keys around
        if key_id not in self.keys:
            raise ValueError(f"Key {key_id} not found")
        
        encrypted_data = base64.b64decode(encrypted_data_b64)
        decrypted_data = self.keys[key_id].fernet.decrypt(encrypted_data)
        
        return decrypted_data
    
    def decrypt_to_string(self, encrypted_data_b64: str, key_id: str) -> str:
        # same as decrypt but returns a string instead of bytes
        return self.decrypt(encrypted_data_b64, key_id).decode('utf-8')
    
    def get_key_info(self) -> Dict:
        # get stats about our keys (useful for monitoring)
        return {
            'active_key_id': self.active_key_id,
            'total_keys': len(self.keys),
            'encryption_count': self.encryption_count,
            'keys': [key.to_dict() for key in self.keys.values()]
        }
    
    def cleanup_old_keys(self, keep_days: int = 365):
        # delete really old keys we don't need anymore
        # keeps at least one key though (obviously)
        if len(self.keys) <= 1:
            return
        
        cutoff_date = datetime.utcnow() - timedelta(days=keep_days)
        keys_to_remove = []
        
        for key_id, key in self.keys.items():
            if key.created_at < cutoff_date and not key.is_active:
                keys_to_remove.append(key_id)
        
        # don't delete ALL keys (that would be bad)
        if len(self.keys) - len(keys_to_remove) < 1:
            keys_to_remove = keys_to_remove[:-1]  # keep the newest old key
        
        for key_id in keys_to_remove:
            del self.keys[key_id]
            logger.info(f"Removed old encryption key: {key_id}")
        
        if keys_to_remove:
            self._save_keys()

# global instance - don't create multiple encryption managers
encryption_manager = None

def init_encryption(master_password: Optional[str] = None) -> EncryptionManager:
    # call this once on app startup
    global encryption_manager
    encryption_manager = EncryptionManager(master_password)
    return encryption_manager

def get_encryption_manager() -> EncryptionManager:
    # grab the global encryption manager when you need it
    if encryption_manager is None:
        raise RuntimeError("Encryption manager not initialized. Call init_encryption() first.")
    return encryption_manager
