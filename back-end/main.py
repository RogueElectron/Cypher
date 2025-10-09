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

# verify access token endpoint (called by session manager)
@app.route('/api/verify-access', methods=['POST'])
def verify_access():
    data = request.get_json()
    access_token = data.get('access_token')
    
    if not access_token:
        return jsonify({'valid': False, 'error': 'Access token required'}), 400
    
    try:
        # parse and validate access token
        parsed = paseto.parse(
            key=session_key,
            purpose='local',
            token=access_token
        )
        
        access_claims = parsed['message']
        
        # check token type
        if access_claims.get('type') != 'access':
            return jsonify({'valid': False, 'error': 'Invalid token type'}), 401
        
        username = access_claims.get('username')
        session_id = access_claims.get('session_id')
        
        if not all([username, session_id]):
            return jsonify({'valid': False, 'error': 'Invalid token claims'}), 401
        
        # check if session still exists
        if session_id not in active_sessions:
            return jsonify({'valid': False, 'error': 'Session expired'}), 401
        
        session_info = active_sessions[session_id]
        if session_info['username'] != username:
            return jsonify({'valid': False, 'error': 'Token mismatch'}), 401
        
        return jsonify({
            'valid': True,
            'username': username,
            'session_id': session_id
        })
        
    except (paseto.ExpireError, paseto.ValidationError):
        return jsonify({'valid': False, 'error': 'Invalid or expired token'}), 401

# refresh token endpoint (called by session manager)
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
        
        # atomically remove token to prevent multiple uses
        token_info = active_refresh_tokens.pop(token_id, None)
        if token_info is None:
            return jsonify({'error': 'Refresh token already used or invalid'}), 401
        
        # verify token belongs to the requesting user and session
        if token_info['username'] != username or token_info['session_id'] != session_id:
            # token mismatch indicates compromise - kill entire session
            if session_id in active_sessions:
                del active_sessions[session_id]
            # remove all refresh tokens for this session
            tokens_to_remove = [tid for tid, tinfo in active_refresh_tokens.items() 
                              if tinfo['session_id'] == session_id]
            for tid in tokens_to_remove:
                del active_refresh_tokens[tid]
            return jsonify({'error': 'Token compromise detected - session terminated'}), 401
        
        # check if session still exists
        if session_id not in active_sessions:
            # session expired - cleanup any orphaned tokens
            tokens_to_remove = [tid for tid, tinfo in active_refresh_tokens.items() 
                              if tinfo['session_id'] == session_id]
            for tid in tokens_to_remove:
                del active_refresh_tokens[tid]
            return jsonify({'error': 'Session expired'}), 401
        
        current_time = time.time()
        active_sessions[session_id]['last_refresh'] = current_time
        
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
            'session_id': session_id,
            'type': 'refresh',
            'token_id': new_refresh_token_id,
            'iat': current_time
        }
        
        # refresh tokens live for 30 days
        new_refresh_token = paseto.create(
            key=refresh_key,
            purpose='local',
            claims=new_refresh_claims,
            exp_seconds=2592000
        )
        
        # track the new refresh token
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
        
    except Exception as error:
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
                if session_id in active_sessions:
                    del active_sessions[session_id]
                    
                    # find all refresh tokens for this session
                    tokens_to_remove = []
                    for token_id, token_info in active_refresh_tokens.items():
                        if token_info['session_id'] == session_id:
                            tokens_to_remove.append(token_id)
                    
                    # remove all refresh tokens for the session
                    for token_id in tokens_to_remove:
                        del active_refresh_tokens[token_id]
                        
        except Exception:
            # ignore errors during cleanup
            pass
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

