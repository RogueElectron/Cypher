#!/usr/bin/env python3
# INTERNAL FACING API FOR TOKEN MINTING
from flask import Flask, request, jsonify
import paseto
from paseto.keys.symmetric_key import SymmetricKey
from paseto.protocols.v4 import ProtocolVersion4
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)

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


@app.route('/health', methods=['GET'])
def health():
    
    #Health check endpoint
    
    return jsonify({'status': 'ok', 'service': 'internal-auth-api'})


if __name__ == '__main__':
    # CRITICAL: Only bind to localhost - never expose externally
    logger.info("Starting internal authentication API on http://127.0.0.1:5001")
    logger.warning("SECURITY: This API should ONLY be accessible from localhost")
    app.run(host='127.0.0.1', port=5001, debug=False)
