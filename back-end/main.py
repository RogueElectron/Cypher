from flask import Flask, send_from_directory, request, session, render_template, url_for, jsonify
from flask_cors import CORS
import base64
from dotenv import load_dotenv
import requests
import os
import json
import datetime
import pyotp
import time


node_api_port = 3000  # Default to 3000 to match Node.js server port
node_api_url = f"http://127.0.0.1:{node_api_port}"

load_dotenv()
app = Flask(__name__)
CORS(app)  # enable CORS for all routes

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

if __name__ == '__main__':
    app.run(debug=True, port=5000)

