from flask import Flask, send_from_directory, request, session, render_template, url_for, jsonify
from flask_cors import CORS
import base64
from dotenv import load_dotenv
import requests
import os

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


@app.route('/api/register/finish', methods=['POST'])
def handle_register_finish():
    print('we got da 2nd request') #debug
    response = requests.post(node_api_url + '/register/finish', json=request.json)
    return response.content, response.status_code


# logout page
@app.route('/api/logout', methods=['POST'])
def handle_logout():

    if request.method == 'POST':
        return "" ## we will implement logout with a button, no need for a whole page


if __name__ == '__main__':
    app.run(debug=True, port=5000)

#choom i need me some preem bds after this