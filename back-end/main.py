from flask import Flask, render_template, request, jsonify, make_response
from flask_cors import CORS
import paseto
from paseto.keys.symmetric_key import SymmetricKey
from paseto.protocols.v4 import ProtocolVersion4
import secrets
import datetime
import time

app = Flask(__name__)
CORS(app, origins=['http://127.0.0.1:5000', 'http://localhost:5000'], supports_credentials=True)

key = SymmetricKey.generate(protocol=ProtocolVersion4)
session_key = SymmetricKey.generate(protocol=ProtocolVersion4)
refresh_key = SymmetricKey.generate(protocol=ProtocolVersion4)

active_sessions = {}
active_refresh_tokens = {}

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
    
    current_time = time.time()
    
    # create unique session identifier
    session_id = secrets.token_urlsafe(32)
    
    # build access token claims
    access_claims = {
        'username': username,
        'session_id': session_id,
        'type': 'access',
        'iat': current_time
    }
    
    # create access token with 15 minute expiry
    access_token = paseto.create(
        key=session_key,
        purpose='local',
        claims=access_claims,
        exp_seconds=900
    )
    
    # generate refresh token with unique tracking id
    refresh_token_id = secrets.token_urlsafe(32)
    refresh_claims = {
        'username': username,
        'session_id': session_id,
        'type': 'refresh',
        'token_id': refresh_token_id,
        'iat': current_time
    }
    
    # refresh tokens last 30 days
    refresh_token = paseto.create(
        key=refresh_key,
        purpose='local',
        claims=refresh_claims,
        exp_seconds=2592000
    )
    
    # register session in active sessions table
    active_sessions[session_id] = {
        'username': username,
        'created_at': current_time,
        'last_refresh': current_time
    }
    
    # track refresh token for validation
    active_refresh_tokens[refresh_token_id] = {
        'username': username,
        'session_id': session_id
    }
    
    return jsonify({
        'success': True,
        'access_token': access_token,
        'refresh_token': refresh_token,
        'expires_in': 900
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)

