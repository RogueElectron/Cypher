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
    
    if not username:
        return jsonify({'error': 'Username required'}), 400
    
    session_id = secrets.token_urlsafe(32)
    current_time = time.time()
    
    access_claims = {
        'username': username,
        'session_id': session_id,
        'type': 'access',
        'iat': current_time
    }
    
    access_token = paseto.create(
        key=session_key,
        purpose='local',
        claims=access_claims,
        exp_seconds=900
    )
    
    refresh_token_id = secrets.token_urlsafe(32)
    refresh_claims = {
        'username': username,
        'session_id': session_id,
        'type': 'refresh',
        'token_id': refresh_token_id,
        'iat': current_time
    }
    
    refresh_token = paseto.create(
        key=refresh_key,
        purpose='local',
        claims=refresh_claims,
        exp_seconds=2592000
    )
    
    active_sessions[session_id] = {
        'username': username,
        'created_at': current_time,
        'last_refresh': current_time
    }
    
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

@app.route('/api/refresh-token', methods=['POST']) 
def refresh_token():
    data = request.get_json()
    refresh_token = data.get('refresh_token')
    
    if not refresh_token:
        return jsonify({'error': 'Refresh token required'}), 400
    
    try:
        parsed = paseto.parse(
            key=refresh_key,
            purpose='local',
            token=refresh_token
        )
        
        refresh_claims = parsed['message']
        
        if refresh_claims.get('type') != 'refresh':
            return jsonify({'error': 'Invalid token type'}), 401
        
        username = refresh_claims.get('username')
        session_id = refresh_claims.get('session_id')
        token_id = refresh_claims.get('token_id')
        
        if not all([username, session_id, token_id]):
            return jsonify({'error': 'Invalid refresh token claims'}), 401
        
        if token_id not in active_refresh_tokens:
            return jsonify({'error': 'Refresh token revoked or invalid'}), 401
        
        token_info = active_refresh_tokens[token_id]
        if token_info['username'] != username or token_info['session_id'] != session_id:
            return jsonify({'error': 'Token mismatch'}), 401
        
        if session_id not in active_sessions:
            return jsonify({'error': 'Session expired'}), 401
        
        current_time = time.time()
        
        active_sessions[session_id]['last_refresh'] = current_time
        
        del active_refresh_tokens[token_id]
        
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
        
        new_refresh_token_id = secrets.token_urlsafe(32)
        new_refresh_claims = {
            'username': username,
            'session_id': session_id,
            'type': 'refresh',
            'token_id': new_refresh_token_id,
            'iat': current_time
        }
        
        new_refresh_token = paseto.create(
            key=refresh_key,
            purpose='local',
            claims=new_refresh_claims,
            exp_seconds=2592000
        )
        
        active_refresh_tokens[new_refresh_token_id] = {
            'username': username,
            'session_id': session_id
        }
        
        return jsonify({
            'success': True,
            'access_token': new_access_token,
            'refresh_token': new_refresh_token,
            'expires_in': 900
        })
        
    except (paseto.ExpireError, paseto.ValidationError):
        return jsonify({'error': 'Invalid or expired refresh token'}), 401

@app.route('/api/verify-access', methods=['POST'])
def verify_access():
    data = request.get_json()
    access_token = data.get('access_token')
    
    if not access_token:
        return jsonify({'valid': False, 'error': 'Access token required'}), 400
    
    try:
        parsed = paseto.parse(
            key=session_key,
            purpose='local',
            token=access_token
        )
        
        access_claims = parsed['message']
        
        if access_claims.get('type') != 'access':
            return jsonify({'valid': False, 'error': 'Invalid token type'}), 401
        
        username = access_claims.get('username')
        session_id = access_claims.get('session_id')
        
        if not username or not session_id:
            return jsonify({'valid': False, 'error': 'Invalid token claims'}), 401
        
        if session_id not in active_sessions:
            return jsonify({'valid': False, 'error': 'Session expired'}), 401
        
        session_info = active_sessions[session_id]
        if session_info['username'] != username:
            return jsonify({'valid': False, 'error': 'Token session mismatch'}), 401
        
        return jsonify({
            'valid': True,
            'username': username,
            'session_id': session_id
        })
        
    except (paseto.ExpireError, paseto.ValidationError):
        return jsonify({'valid': False, 'error': 'Invalid or expired access token'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    data = request.get_json()
    access_token = data.get('access_token')
    refresh_token = data.get('refresh_token')
    
    session_id = None
    username = None
    
    if access_token:
        try:
            parsed = paseto.parse(
                key=session_key,
                purpose='local',
                token=access_token
            )
            session_id = parsed['message'].get('session_id')
            username = parsed['message'].get('username')
        except:
            pass
    
    if not session_id and refresh_token:
        try:
            parsed = paseto.parse(
                key=refresh_key,
                purpose='local',
                token=refresh_token
            )
            session_id = parsed['message'].get('session_id')
            username = parsed['message'].get('username')
            token_id = parsed['message'].get('token_id')
            
            if token_id and token_id in active_refresh_tokens:
                del active_refresh_tokens[token_id]
        except:
            pass
    
    if session_id and session_id in active_sessions:
        del active_sessions[session_id]
        
        tokens_to_remove = []
        for token_id, token_info in active_refresh_tokens.items():
            if token_info['session_id'] == session_id:
                tokens_to_remove.append(token_id)
        
        for token_id in tokens_to_remove:
            del active_refresh_tokens[token_id]
    
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)

