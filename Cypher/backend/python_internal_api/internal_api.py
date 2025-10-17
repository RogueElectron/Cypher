#!/usr/bin/env python3
"""
Internal Python API for authentication endpoints
SECURITY: Only accessible via localhost - NOT exposed to external clients
Called by Node.js internal API for OPAQUE authentication flow
"""

from flask import Flask, request, jsonify
import paseto
from paseto.keys.symmetric_key import SymmetricKey
from paseto.protocols.v4 import ProtocolVersion4
import os
import sys
import secrets
import datetime
import time
import logging
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path for database imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.database import (
    get_db_session,
    get_session_manager, get_token_manager, get_rate_limiter,
    User, UserSession, RefreshToken, AuditLog,
    init_databases, init_redis_managers
)

# Load environment variables
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)

# Initialize databases and Redis on startup
def initialize_services():
    """Initialize database connections and Redis managers"""
    try:
        if not init_databases():
            logger.error("Failed to initialize databases")
            return False
        
        init_redis_managers()
        logger.info("Internal API services initialized")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        return False

# Load PASETO keys from environment (same as main Flask app)
try:
    key_hex = os.getenv('PASETO_KEY')
    session_key_hex = os.getenv('PASETO_SESSION_KEY')
    refresh_key_hex = os.getenv('PASETO_REFRESH_KEY')
    
    if not all([key_hex, session_key_hex, refresh_key_hex]):
        raise ValueError("PASETO keys not found in environment. Run generate_secrets.sh to generate them.")
    
    # Load keys from hex strings
    key = SymmetricKey(key_material=bytes.fromhex(key_hex), protocol=ProtocolVersion4)
    session_key = SymmetricKey(key_material=bytes.fromhex(session_key_hex), protocol=ProtocolVersion4)
    refresh_key = SymmetricKey(key_material=bytes.fromhex(refresh_key_hex), protocol=ProtocolVersion4)
    
    logger.info("PASETO keys loaded from environment")
except Exception as e:
    logger.error(f"Failed to load PASETO keys: {e}")
    logger.warning("Generating temporary keys - these will NOT persist across restarts!")
    key = SymmetricKey.generate(protocol=ProtocolVersion4)
    session_key = SymmetricKey.generate(protocol=ProtocolVersion4)
    refresh_key = SymmetricKey.generate(protocol=ProtocolVersion4)


@app.route('/internal/create-token', methods=['POST'])
def create_token():
    
    #Create intermediate pass_authed token for TOTP phase
    #INTERNAL ONLY - called by Node.js after OPAQUE password verification
    
    data = request.get_json()
    username = data.get('username')
    
    if not username:
        return jsonify({'error': 'Username required'}), 400
    
    claims = {
        'username': username,
        'pass_authed': True
    }
    
    token = paseto.create(
        key=key,
        purpose='local',
        claims=claims,
        exp_seconds=180  # 3 minutes - just for TOTP verification
    )
    
    logger.info(f"Created pass_authed token for user: {username}")
    return jsonify({'token': token})


@app.route('/internal/verify-token', methods=['POST'])
def verify_token():
    
    #Verify intermediate pass_authed token before TOTP
    #INTERNAL ONLY - called by Node.js to validate token before TOTP check
    
    data = request.get_json()
    token = data.get('token')
    username = data.get('username')
    
    if not token:
        return jsonify({'error': 'Token required'}), 400
    
    if not username:
        return jsonify({'error': 'Username required'}), 400
    
    try:
        parsed = paseto.parse(
            key=key,
            purpose='local',
            token=token
        )
        
        token_username = parsed['message'].get('username')
        pass_authed = parsed['message'].get('pass_authed')
        
        if token_username != username:
            logger.warning(f"Token username mismatch for {username}")
            return jsonify({'valid': False, 'error': 'Token username mismatch'}), 401
        
        if pass_authed is not True:
            logger.warning(f"Token missing pass_authed claim for {username}")
            return jsonify({'valid': False, 'error': 'Token pass_authed claim missing'}), 401
        
        return jsonify({
            'valid': True,
            'claims': parsed['message']
        })
        
    except (paseto.ExpireError, paseto.ValidationError) as e:
        logger.warning(f"Invalid token for {username}: {e}")
        return jsonify({'valid': False, 'error': 'Invalid or expired token'}), 401


@app.route('/internal/create-session', methods=['POST'])
def create_session():
    
    #Create full session tokens (access + refresh) after successful authentication
    #INTERNAL ONLY - called by Node.js after TOTP verification
    
    data = request.get_json()
    username = data.get('username')
    
    if not username:
        return jsonify({'error': 'Username required'}), 400
    
    try:
        # Use localhost as IP since this is internal
        client_ip = '127.0.0.1'
        
        # Rate limit check - protect against internal abuse
        rate_limit = get_rate_limiter().check_rate_limit(
            identifier=username,  # Use username for internal rate limiting
            limit=10,
            window_seconds=60,
            category="session_creation"
        )
        
        if not rate_limit['allowed']:
            return jsonify({
                'error': 'Rate limit exceeded',
                'retry_after': rate_limit['reset_time']
            }), 429
        
        current_time = time.time()
        
        # Find the user
        with get_db_session() as db_session:
            user = db_session.query(User).filter_by(username=username, is_active=True).first()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Check if account is locked
            if user.is_locked():
                return jsonify({'error': 'Account temporarily locked'}), 423
            
            # Create Redis session
            session_data = {
                'user_id': str(user.id),
                'username': username,
                'ip_address': client_ip,
                'user_agent': 'Internal API',
                'device_fingerprint': data.get('device_fingerprint', '')
            }
            
            # Create session
            session_id = get_session_manager().create_session(
                user_id=str(user.id),
                session_data=session_data,
                ttl=3600  # 1 hour
            )
            
            # Save to PostgreSQL for persistence
            db_session_obj = UserSession(
                session_id=session_id,
                user_id=user.id,
                ip_address=client_ip,
                user_agent='Internal API',
                device_fingerprint=data.get('device_fingerprint', ''),
                expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=1)
            )
            db_session_obj.set_session_data(session_data)
            db_session.add(db_session_obj)
            
            # Build access token
            access_claims = {
                'username': username,
                'user_id': str(user.id),
                'session_id': session_id,
                'type': 'access',
                'iat': current_time
            }
            
            # 15 minute access token
            access_token = paseto.create(
                key=session_key,
                purpose='local',
                claims=access_claims,
                exp_seconds=900
            )
            
            # Create refresh token
            refresh_token_id = secrets.token_urlsafe(32)
            refresh_claims = {
                'username': username,
                'user_id': str(user.id),
                'session_id': session_id,
                'type': 'refresh',
                'token_id': refresh_token_id,
                'iat': current_time
            }
            
            # Refresh tokens live for a week
            refresh_token = paseto.create(
                key=refresh_key,
                purpose='local',
                claims=refresh_claims,
                exp_seconds=7 * 24 * 3600
            )
            
            # Save refresh token to database
            db_refresh_token = RefreshToken(
                token_id=refresh_token_id,
                user_id=user.id,
                session_id=session_id,
                token_hash=secrets.token_hex(16),
                expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7)
            )
            db_refresh_token.set_token_data({
                'user_agent': 'Internal API',
                'ip_address': client_ip
            })
            db_session.add(db_refresh_token)
            
            # Cache in Redis
            get_token_manager().cache_refresh_token(
                user_id=str(user.id),
                token_id=refresh_token_id,
                token_data=refresh_claims,
                ttl=7 * 24 * 3600
            )
            
            # Update last login time
            user.last_login_at = datetime.datetime.utcnow()
            
            # Audit log
            audit_log = AuditLog(
                event_type='session_created',
                event_category='AUTH',
                severity='INFO',
                user_id=user.id,
                session_id=session_id,
                ip_address=client_ip,
                user_agent='Internal API',
                success=True
            )
            audit_log.set_event_details({
                'session_duration': '15 minutes',
                'refresh_token_duration': '7 days',
                'created_by': 'internal_api'
            })
            db_session.add(audit_log)
            
            db_session.commit()
            
            logger.info(f"Session created for user {username} via internal API")
            
            return jsonify({
                'success': True,
                'access_token': access_token,
                'refresh_token': refresh_token,
                'expires_in': 900
            })
            
    except Exception as e:
        logger.error(f"Session creation error: {e}")
        return jsonify({'error': 'Session creation failed'}), 500


@app.route('/health', methods=['GET'])
def health():
    
    #Health check endpoint
    
    return jsonify({'status': 'ok', 'service': 'internal-auth-api'})


if __name__ == '__main__':
    # CRITICAL: Only bind to localhost - never expose externally
    
    # Initialize database and Redis connections
    if not initialize_services():
        logger.critical("Failed to initialize internal API services. Exiting.")
        sys.exit(1)
    
    # Suppress Flask request logs
    import logging as log
    log.getLogger('werkzeug').setLevel(log.ERROR)
    
    logger.info("Starting internal authentication API on http://127.0.0.1:5001")
    logger.warning("SECURITY: This API should ONLY be accessible from localhost")
    app.run(host='127.0.0.1', port=5001, debug=False)
