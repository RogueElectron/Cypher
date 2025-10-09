# Cypher Database Layer Implementation

## Overview

The Cypher project has been upgraded from in-memory storage to a robust PostgreSQL/Redis hybrid database architecture with encryption at rest and automatic key rotation.

## Architecture

### **Hybrid Database Design**
- **PostgreSQL**: Persistent storage for users, sessions, tokens, and audit logs
- **Redis**: High-speed caching for active sessions, rate limiting, and device tracking
- **Encryption Layer**: Transparent encryption at rest with automatic key rotation

###  **Security Features**
- **Encryption at Rest**: All sensitive data encrypted using Fernet (AES 128)
- **Key Rotation**: Automatic key rotation based on age (90 days) or usage (1M operations)
- **Zero-Knowledge Design**: Maintains OPAQUE protocol's zero-knowledge properties
- **Audit Logging**: Complete audit trail for compliance and security monitoring

## Components

### 1. Database Configuration (`src/database_config.py`)
- **PostgreSQL Connection**: Connection pooling with automatic reconnection
- **Redis Connection**: High-performance Redis client with health monitoring
- **Context Managers**: Safe database session handling with automatic cleanup

### 2. Encryption Manager (`src/encryption_manager.py`)
- **Key Management**: Secure key generation, storage, and rotation
- **Transparent Encryption**: Automatic encryption/decryption for database fields
- **Key Derivation**: PBKDF2-based master key derivation
- **Backward Compatibility**: Support for multiple keys during rotation

### 3. Database Models (`src/models.py`)
- **User Model**: Encrypted OPAQUE records and TOTP secrets
- **Session Model**: Encrypted session data with device tracking
- **Token Model**: Refresh token management with security metadata
- **Audit Model**: Comprehensive security event logging

### 4. Redis Management (`src/redis_manager.py`)
- **Session Manager**: Fast session storage and retrieval
- **Token Manager**: Token blacklisting and caching
- **Rate Limiter**: Sliding window rate limiting
- **Device Tracker**: Device fingerprinting and trust management

## Setup Instructions

### Prerequisites
- Docker and Docker Compose
- Python 3.8+
- PostgreSQL 15+
- Redis 7+

### Quick Setup
```bash
# 1. Copy environment configuration
cp .env.example .env

# 2. Edit .env with your settings (IMPORTANT!)
nano .env

# 3. Run setup script
./setup_database.sh
```

### Manual Setup
```bash
# 1. Start databases
docker-compose up -d postgres redis

# 2. Install dependencies
pip install -r requirements.txt

# 3. Initialize database
python migrations/init_db.py --all

# 4. Start application
python main.py
```

## Environment Configuration

### Required Environment Variables
```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=cypher_user
POSTGRES_PASSWORD=change_this_password
POSTGRES_DB=cypher_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional_redis_password

# Encryption (CHANGE THESE!)
MASTER_ENCRYPTION_PASSWORD=your_super_secure_master_password
KEY_ROTATION_DAYS=90
KEY_STORE_PATH=/secure/path/to/keys
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    opaque_record TEXT,           -- Encrypted OPAQUE data
    opaque_record_key_id VARCHAR(255),
    totp_secret TEXT,             -- Encrypted TOTP secret
    totp_secret_key_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    totp_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE
);
```

### Sessions Table
```sql
CREATE TABLE user_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL,
    session_data TEXT,            -- Encrypted session data
    session_data_key_id VARCHAR(255),
    ip_address VARCHAR(45),
    device_fingerprint VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
);
```

## Security Features

### **Encryption at Rest**
- All sensitive database fields are automatically encrypted
- Uses Fernet symmetric encryption (AES 128 in CBC mode)
- Keys derived from master password using PBKDF2
- Each encrypted field has associated key ID for rotation support

### **Key Rotation**
- Automatic rotation based on configurable criteria:
  - Age: Default 90 days
  - Usage: Default 1M encryption operations
- Seamless rotation without service interruption
- Old keys retained for decryption during transition

### **Audit Logging**
All security events are logged with encryption:
- User authentication attempts
- Session creation/destruction  
- Token issuance/refresh
- Key rotation events
- Administrative actions

### **Performance Optimization**
- **Redis Caching**: Active sessions cached for sub-millisecond access
- **Connection Pooling**: Optimized PostgreSQL connection management
- **Lazy Loading**: Encryption keys loaded on demand
- **Batch Operations**: Efficient bulk database operations

## API Changes

The API endpoints remain backward compatible, but now include enhanced security:

### Enhanced Rate Limiting
```python
# Rate limiting per IP
rate_limit = get_rate_limiter().check_rate_limit(
    identifier=client_ip,
    limit=10,
    window_seconds=60,
    category="authentication"
)
```

### Token Blacklisting
```python
# Check if token is blacklisted
if get_token_manager().is_token_blacklisted(token):
    return jsonify({'error': 'Token blacklisted'}), 401
```

### Device Tracking
```python
# Register device for security monitoring
device_tracker.register_device(
    user_id=user_id,
    device_fingerprint=fingerprint,
    device_info=device_data
)
```

## Monitoring and Management

### Health Checks
```python
from src.database_config import db_config

# Check database health
health = db_config.health_check()
# Returns: {'postgres': True, 'redis': True}
```

### Key Rotation Status
```python
from src.encryption_manager import get_encryption_manager

# Get key information
key_info = get_encryption_manager().get_key_info()
# Returns key count, active key, rotation status
```

### Management Tools
- **pgAdmin**: http://localhost:8081 (PostgreSQL management)
- **Redis Commander**: http://localhost:8082 (Redis management)

Start with tools:
```bash
docker-compose --profile tools up -d
```

## Production Deployment

### Security Checklist
- [ ] Change all default passwords in `.env`
- [ ] Use strong master encryption password (32+ chars)
- [ ] Set up SSL/TLS for database connections
- [ ] Configure firewall rules for database ports
- [ ] Enable database-level encryption
- [ ] Set up automated backups
- [ ] Configure log rotation
- [ ] Monitor key rotation events

### Performance Tuning
- [ ] Adjust PostgreSQL shared_buffers (25% of RAM)
- [ ] Configure Redis maxmemory (based on session count)
- [ ] Set up database connection pooling limits
- [ ] Configure appropriate cache TTLs
- [ ] Monitor and tune query performance

### Backup Strategy
- **PostgreSQL**: Use `pg_dump` for regular backups
- **Redis**: Configure AOF and RDB snapshots
- **Encryption Keys**: Secure backup of key store directory
- **Application Config**: Version control all configuration

## Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check if services are running
docker-compose ps

# View logs
docker-compose logs postgres redis
```

**Encryption Key Issues**
```bash
# Check key store permissions
ls -la .keys/

# Verify master password in .env
grep MASTER_ENCRYPTION_PASSWORD .env
```

**Performance Issues**
```bash
# Check Redis memory usage
docker-compose exec redis redis-cli info memory

# Monitor PostgreSQL connections
docker-compose exec postgres psql -U cypher_user -d cypher_db -c "SELECT * FROM pg_stat_activity;"
```

## Migration from In-Memory

The new system is designed to be backward compatible. Existing OPAQUE implementations will work without changes, but you'll gain:

- ✅ **Persistence**: No data loss on restart
- ✅ **Scalability**: Support for multiple application instances  
- ✅ **Security**: Encryption at rest and audit logging
- ✅ **Monitoring**: Health checks and performance metrics
- ✅ **Compliance**: Full audit trail for regulations

## Contributing

When adding new encrypted fields:

1. Add encrypted field columns to model
2. Add corresponding `_key_id` column
3. Create EncryptedField descriptor
4. Update migration scripts
5. Add appropriate indexes

Example:
```python
class User(Base):
    # Add encrypted field
    sensitive_data = Column(Text, nullable=True)
    sensitive_data_key_id = Column(String(255), nullable=True)
    
    # Add descriptor
    encrypted_sensitive_data = EncryptedField('sensitive_data')
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Verify configuration: Compare with `.env.example`
3. Test database connectivity: `python migrations/init_db.py --create-db`
4. Review audit logs for security events
