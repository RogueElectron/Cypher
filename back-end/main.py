from flask import Flask, send_from_directory, request, session, render_template, url_for, jsonify
from flask_cors import CORS
import base64
from dotenv import load_dotenv
import requests
import os
import json
import sqlite3
import datetime

node_api_port = 3000  # Default to 3000 to match Node.js server port
node_api_url = f"http://127.0.0.1:{node_api_port}"

load_dotenv()
app = Flask(__name__)
CORS(app)  # enable CORS for all routes

# Database setup
DATABASE_PATH = 'cypher_users.db'

def init_database():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            registration_record TEXT NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()

def store_user_registration(username, registration_record):
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        # TODO input sanitization, both ways, out and in, second order sqli is no joke
        record_json = json.dumps(registration_record)
        
        cursor.execute('''
            INSERT INTO users (username, registration_record)
            VALUES (?, ?)
        ''', (username, record_json))
        
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        # Username already exists
        conn.close()
        return False
    except Exception as e:
        print(f"Database error: {e}")
        conn.close()
        return False

def get_user_registration(username):
    # for the authentication part
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT registration_record FROM users WHERE username = ?
        ''', (username,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return json.loads(result[0])
        return None
    except Exception as e:
        print(f"Database error: {e}")
        return None

# init db on startup
init_database()

#root
@app.route('/')
def serve_index():
    return render_template('index.html')


# remember to add the 2fa api

# login page
@app.route('/api/login', methods=['POST'])     
def serve_login():
    if request.method == 'GET':
        return render_template('login.html')

# register page
@app.route('/api/register', methods=['GET'])
def serve_register():
    if request.method == 'GET':
        return render_template('register.html')

# OPAQUE routing
# so choom this just forwards it to the node js api
# TODO IMPLEMENT INPUT SANITIZATION
# TODO implement error handling
# TODO implement timeout
# TODO use urljoin 
# TODO implement header forwarding 

@app.route('/api/register/init', methods=['POST'])
def handle_register_init():
    
    print('we got da request') #debug
    response = requests.post(node_api_url + '/register/init', json=request.json)
    return response.content, response.status_code


@app.route('/api/register/finish', methods=['POST']) # we can just store it instead of passing it around
def handle_register_finish():
    print('we got da 2nd request') #debug
    # json responses are already parsed by flask
    username = request.json['username']
    registrationRecord = request.json['registrationRecord']
    
    print(f"Storing registration for user: {username}")
    
    # Store the registration record in SQLite
    success = store_user_registration(username, registrationRecord)
    
    if success:
        print(f"Successfully stored registration for {username}")
        return jsonify({
            "status": "success", 
            "message": "Registration completed and stored successfully"
        }), 200
    else:
        print(f"Failed to store registration for {username} - user may already exist")
        return jsonify({
            "status": "error", 
            "message": "Registration failed - username may already exist"
        }), 400

@app.route('/api/login/init', methods=['POST'])
def handle_login_init():
    ke1 = request.json['ke1']
    username = request.json['username']
    registrationRecord = get_user_registration(username)
    
    response = requests.post(node_api_url + '/login/init', json={
        'ke1': ke1,
        'username': username,
        'registrationRecord': registrationRecord
    })
    print('we got da request') #debug
    return response.content, response.status_code


    

@app.route('/api/login/init', methods=['POST'])
def handle_logout():
    
    print('we got da request') #debug
    


if __name__ == '__main__':
    app.run(debug=True, port=5000)

#choom i need me some preem bds after this