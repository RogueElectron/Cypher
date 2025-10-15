from flask import Flask, render_template, request, jsonify, make_response
from flask_cors import CORS
import bleach
import paseto
from paseto.keys.symmetric_key import SymmetricKey
from paseto.protocols.v4 import ProtocolVersion4
import secrets
import datetime
import time
import os
import logging
from contextlib import contextmanager
from dotenv import load_dotenv

# import our database stuff
import sys
from pathlib import Path

# load env vars first - search up to find .env in project root
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)
# Add parent directory to path so we can import from backend package
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.database import (
    init_databases, get_db_session, Base, db_config,
    init_encryption,
    init_redis_managers, get_session_manager, get_token_manager, get_rate_limiter,
    User, UserSession, RefreshToken, AuditLog
)
from sqlalchemy import create_engine

# setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Flask needs to know where templates and static files are
# They're in front-end/ directory, not backend/Flask-server/
project_root = Path(__file__).parent.parent.parent
template_folder = project_root / 'front-end' / 'templates'
static_folder = project_root / 'front-end' / 'static'

app = Flask(__name__, 
            template_folder=str(template_folder),
            static_folder=str(static_folder))
CORS(app, origins=['http://127.0.0.1:5000', 'http://localhost:5000'], supports_credentials=True)

# xss recursive sanitizer

def sanitize_recursive(obj):
    if isinstance(obj, dict):
        return {key: sanitize_recursive(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_recursive(item) for item in obj]
    elif isinstance(obj, str):
        return bleach.clean(obj, tags=[], strip=True)
    else:
        return obj

@app.before_request
def sanitize_json_input():
    if request.is_json and request.get_json(silent=True):
        try:
            original_data = request.get_json()
            if original_data:
                request._cached_json = (sanitize_recursive(original_data), original_data)
        except Exception as e:
            logger.warning(f"Failed to sanitize JSON input: {e}")

# paseto keys - TODO: load these from secure storage in prod
key = SymmetricKey.generate(protocol=ProtocolVersion4)
session_key = SymmetricKey.generate(protocol=ProtocolVersion4)
refresh_key = SymmetricKey.generate(protocol=ProtocolVersion4)

# track if db is ready
db_initialized = False

def initialize_app():
    """boots up all the backend services"""
    global db_initialized
    
    try:
        # fire up encryption
        init_encryption()
        logger.info("Encryption manager initialized")
        
        # connect to databases
        if init_databases():
            logger.info("Databases initialized successfully")
            db_initialized = True
        else:
            logger.error("Failed to initialize databases")
            return False
        
        # start redis managers
        init_redis_managers()
        logger.info("Redis managers initialized")
        
        # make sure tables exist
        Base.metadata.create_all(bind=db_config.engine)
        logger.info("Database tables created/verified")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize app: {e}")
        return False

# boot everything up
if not initialize_app():
    logger.critical("Failed to initialize application. Exiting.")
    exit(1)

@app.route('/')
def serve_index():
    return render_template('index.html')

@app.route('/api/login', methods=['GET'])     
def serve_login():
    return render_template('login.html')

@app.route('/api/register', methods=['GET'])
def serve_register():
    return render_template('register.html')

@app.route('/api/totp', methods=['GET'])
def serve_totp():
    return render_template('totp.html')

@app.route('/api/create-token', methods=['POST'])
def create_token():
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
        exp_seconds=180
    )
    
    return jsonify({'token': token})

@app.route('/api/verify-token', methods=['POST'])
def verify_token():
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
            return jsonify({'valid': False, 'error': 'Token username mismatch'}), 401
        
        if pass_authed is not True:
            return jsonify({'valid': False, 'error': 'Token pass_authed claim missing'}), 401
        
        return jsonify({
            'valid': True,
            'claims': parsed['message']
        })
        
    except (paseto.ExpireError, paseto.ValidationError):
        return jsonify({'valid': False, 'error': 'Invalid or expired token'}), 401

@app.route('/api/create-session', methods=['POST'])
def create_session():
    data = request.get_json()
    username = data.get('username')
    
    if not username:
        return jsonify({'error': 'Username required'}), 400
    
    try:
        # check if they're spamming requests
        client_ip = request.remote_addr
        rate_limit = get_rate_limiter().check_rate_limit(
            identifier=client_ip,
            limit=10,  # 10 requests per minute
            window_seconds=60,
            category="session_creation"
        )
        
        if not rate_limit['allowed']:
            return jsonify({
                'error': 'Rate limit exceeded',
                'retry_after': rate_limit['reset_time']
            }), 429
        
        current_time = time.time()
        
        # find the user
        with get_db_session() as db_session:
            user = db_session.query(User).filter_by(username=username, is_active=True).first()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # bail if account is locked
            if user.is_locked():
                return jsonify({'error': 'Account temporarily locked'}), 423
            
            # create redis session for speed
            session_data = {
                'user_id': str(user.id),
                'username': username,
                'ip_address': client_ip,
                'user_agent': request.headers.get('User-Agent', ''),
                'device_fingerprint': data.get('device_fingerprint', '')
            }
            
            # create session - IMPORTANT: use the returned session_id for everything
            # was creating separate session_id before which caused "session mismatch" errors
            session_id = get_session_manager().create_session(
                user_id=str(user.id),
                session_data=session_data,
                ttl=3600  # 1 hour
            )
            
            # also save to postgres for persistence
            db_session_obj = UserSession(
                session_id=session_id,
                user_id=user.id,
                ip_address=client_ip,
                user_agent=request.headers.get('User-Agent', ''),
                device_fingerprint=data.get('device_fingerprint', ''),
                expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=1)
            )
            db_session_obj.set_session_data(session_data)
            db_session.add(db_session_obj)
            
            # build the access token
            access_claims = {
                'username': username,
                'user_id': str(user.id),
                'session_id': session_id,  # now this actually matches the redis session
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
            
            # make the refresh token
            refresh_token_id = secrets.token_urlsafe(32)
            refresh_claims = {
                'username': username,
                'user_id': str(user.id),
                'session_id': session_id,
                'type': 'refresh',
                'token_id': refresh_token_id,
                'iat': current_time
            }
            
            # refresh tokens live for a week
            refresh_token = paseto.create(
                key=refresh_key,
                purpose='local',
                claims=refresh_claims,
                exp_seconds=7 * 24 * 3600
            )
            
            # save refresh token to db
            db_refresh_token = RefreshToken(
                token_id=refresh_token_id,
                user_id=user.id,
                session_id=session_id,
                token_hash=secrets.token_hex(16),  # Store hash, not actual token
                expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7)
            )
            db_refresh_token.set_token_data({
                'user_agent': request.headers.get('User-Agent', ''),
                'ip_address': client_ip
            })
            db_session.add(db_refresh_token)
            
            # cache in redis too
            get_token_manager().cache_refresh_token(
                user_id=str(user.id),
                token_id=refresh_token_id,
                token_data=refresh_claims,
                ttl=7 * 24 * 3600
            )
            
            # update last login time
            user.last_login_at = datetime.datetime.utcnow()
            
            # log it for auditing
            audit_log = AuditLog(
                event_type='session_created',
                event_category='AUTH',
                severity='INFO',
                user_id=user.id,
                session_id=session_id,
                ip_address=client_ip,
                user_agent=request.headers.get('User-Agent', ''),
                success=True
            )
            audit_log.set_event_details({
                'session_duration': '15 minutes',
                'refresh_token_duration': '7 days'
            })
            db_session.add(audit_log)
            
            db_session.commit()
            
            return jsonify({
                'success': True,
                'access_token': access_token,
                'refresh_token': refresh_token,
                'expires_in': 900
            })
            
    except Exception as e:
        logger.error(f"Session creation error: {e}")
        return jsonify({'error': 'Session creation failed'}), 500

# verify access token endpoint (called by session manager)
@app.route('/api/verify-access', methods=['POST'])
def verify_access():
    data = request.get_json()
    access_token = data.get('access_token')
    
    if not access_token:
        logger.debug("verify-access: no token provided")
        return jsonify({'valid': False, 'error': 'Access token required'}), 400
    
    # Check if token is blacklisted
    if get_token_manager().is_token_blacklisted(access_token):
        logger.debug("verify-access: token is blacklisted")
        return jsonify({'valid': False, 'error': 'Token blacklisted'}), 401
    
    try:
        # Parse and validate access token
        parsed = paseto.parse(
            key=session_key,
            purpose='local',
            token=access_token
        )
        
        access_claims = parsed['message']
        
        # Check token type
        if access_claims.get('type') != 'access':
            return jsonify({'valid': False, 'error': 'Invalid token type'}), 401
        
        username = access_claims.get('username')
        session_id = access_claims.get('session_id')
        user_id = access_claims.get('user_id')
        
        if not all([username, session_id, user_id]):
            return jsonify({'valid': False, 'error': 'Invalid token claims'}), 401
        
        # Check session in Redis first (fast check)
        redis_session = get_session_manager().get_session(session_id)
        if not redis_session:
            # Fallback to database check
            try:
                with get_db_session() as db_session:
                    db_session_obj = db_session.query(UserSession).filter_by(
                        session_id=session_id, 
                        is_active=True
                    ).first()
                    
                    if not db_session_obj or db_session_obj.is_expired():
                        return jsonify({'valid': False, 'error': 'Session expired'}), 401
                    
                    # Restore session to Redis
                    session_data = db_session_obj.get_session_data()
                    get_session_manager().create_session(
                        user_id=str(db_session_obj.user_id),
                        session_data=session_data,
                        ttl=3600
                    )
                    
            except Exception as e:
                logger.error(f"Session verification error: {e}")
                return jsonify({'valid': False, 'error': 'Session verification failed'}), 401
        
        # Verify session belongs to the user
        session_data = redis_session.get('data', {}) if redis_session else {}
        if session_data.get('username') != username:
            return jsonify({'valid': False, 'error': 'Session mismatch'}), 401
        
        return jsonify({
            'valid': True,
            'username': username,
            'user_id': user_id,
            'session_id': session_id
        })
        
    except (paseto.ExpireError, paseto.ValidationError) as e:
        logger.warning(f"Invalid access token: {e}")
        return jsonify({'valid': False, 'error': 'Invalid or expired token'}), 401
    except Exception as e:
        logger.error(f"Access token verification error: {e}")
        return jsonify({'valid': False, 'error': 'Token verification failed'}), 500

# refresh token endpoint (called by session manager)
@app.route('/api/refresh-token', methods=['POST']) 
def refresh_token():
    data = request.get_json()
    refresh_token_str = data.get('refresh_token')
    
    if not refresh_token_str:
        return jsonify({'error': 'Refresh token required'}), 400
    
    try:
        # Parse refresh token
        parsed = paseto.parse(
            key=refresh_key,
            purpose='local',
            token=refresh_token_str
        )
        
        refresh_claims = parsed['message']
        
        if refresh_claims.get('type') != 'refresh':
            return jsonify({'error': 'Invalid token type'}), 401
        
        username = refresh_claims.get('username')
        session_id = refresh_claims.get('session_id')
        token_id = refresh_claims.get('token_id')
        user_id = refresh_claims.get('user_id')
        
        if not all([username, session_id, token_id, user_id]):
            return jsonify({'error': 'Invalid refresh token claims'}), 401
        
        # Check token in database
        with get_db_session() as db:
            db_token = db.query(RefreshToken).filter_by(
                token_id=token_id,
                is_active=True,
                is_revoked=False
            ).first()
            
            if not db_token or db_token.is_expired():
                return jsonify({'error': 'Refresh token expired or invalid'}), 401
            
            # Mark token as used (one-time use)
            db_token.is_active = False
            db_token.used_at = datetime.datetime.utcnow()
            
            # Verify session still exists
            redis_session = get_session_manager().get_session(session_id)
            if not redis_session:
                # Check database fallback
                db_session_obj = db.query(UserSession).filter_by(
                    session_id=session_id,
                    is_active=True
                ).first()
                
                if not db_session_obj or db_session_obj.is_expired():
                    return jsonify({'error': 'Session expired'}), 401
            
            current_time = time.time()
        
        # generate new access token with 15 minute expiry
        new_access_claims = {
            'username': username,
            'session_id': session_id,
            'type': 'access',
            'iat': current_time
        }
        
        new_access_token = paseto.create(
            key=session_key,
            purpose='local',
            claims=new_access_claims,
            exp_seconds=900
        )
        
        # create new refresh token with unique id
        new_refresh_token_id = secrets.token_urlsafe(32)
        new_refresh_claims = {
            'username': username,
            'user_id': user_id,
            'session_id': session_id,
            'type': 'refresh',
            'token_id': new_refresh_token_id,
            'iat': current_time
        }
        
        # refresh tokens live for 7 days
        new_refresh_token = paseto.create(
            key=refresh_key,
            purpose='local',
            claims=new_refresh_claims,
            exp_seconds=7 * 24 * 3600
        )
        
        # Store new refresh token in database (within the existing db session)
        with get_db_session() as db:
            new_db_token = RefreshToken(
                token_id=new_refresh_token_id,
                user_id=user_id,
                session_id=session_id,
                token_hash=secrets.token_hex(16),
                expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7)
            )
            new_db_token.set_token_data({
                'refreshed_from': token_id
            })
            db.add(new_db_token)
            db.commit()
        
        # Cache in Redis
        get_token_manager().cache_refresh_token(
            user_id=user_id,
            token_id=new_refresh_token_id,
            token_data=new_refresh_claims,
            ttl=7 * 24 * 3600
        )
        
        return jsonify({
            'success': True,
            'access_token': new_access_token,
            'refresh_token': new_refresh_token,
            'expires_in': 900
        })
        
    except Exception as error:
        logger.error(f"Token refresh error: {error}")
        return jsonify({'error': 'Token refresh failed'}), 500

# logout endpoint to clean up sessions
@app.route('/api/logout', methods=['POST'])
def logout():
    data = request.get_json()
    access_token = data.get('access_token')
    refresh_token = data.get('refresh_token')
    
    if access_token:
        try:
            # extract session info from access token
            parsed = paseto.parse(
                key=session_key,
                purpose='local',
                token=access_token
            )
            
            access_claims = parsed['message']
            session_id = access_claims.get('session_id')
            
            if session_id:
                # clean up session and all associated tokens
                # Blacklist the access token
                get_token_manager().blacklist_token(access_token, ttl=900)
                
                # Delete session from Redis
                get_session_manager().delete_session(session_id)
                
                # Revoke all refresh tokens for this session in database
                with get_db_session() as db:
                    db.query(RefreshToken).filter_by(session_id=session_id).update({
                        'is_active': False,
                        'is_revoked': True
                    })
                    
                    # Deactivate session in database
                    db.query(UserSession).filter_by(session_id=session_id).update({
                        'is_active': False
                    })
                    
                    db.commit()
                        
        except Exception as e:
            logger.warning(f"Logout cleanup error: {e}")
            # ignore errors during cleanup - still return success
            pass
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

