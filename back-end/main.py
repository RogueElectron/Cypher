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
            credentialfileb64 TEXT NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()

def store_user_registration(username, registration_record):
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        # TODO input sanitization, both ways, out and in, second order sqli is no joke
        
        cursor.execute('''
            INSERT INTO users (username, credentialfileb64)
            VALUES (?, ?)
        ''', (username, registration_record))
        print('record stored', registration_record)
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
            SELECT credentialfileb64 FROM users WHERE username = ?
        ''', (username,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return result[0]
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
@app.route('/api/login', methods=['GET'])     
def serve_login():
    if request.method == 'GET':
        return render_template('login.html')

# register page
@app.route('/api/register', methods=['GET'])
def serve_register():
    if request.method == 'GET':
        return render_template('register.html')


# register page
@app.route('/api/register', methods=['GET'])
def handle_logout():
    pass

if __name__ == '__main__':
    app.run(debug=True, port=5000)

#choom i need me some preem bds after this