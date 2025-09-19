from flask import Flask, send_from_directory, request, session, render_template, url_for, jsonify
from flask_cors import CORS
import base64
from dotenv import load_dotenv
import requests
import os

port = int(os.getenv('NODE_API_PORT', 3000))  # so it needs a default so i passed the one from the .env as default


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

@app.route('/api/register/init', methods=['POST'])
def handle_register_init():
    print(f"Headers: {dict(request.headers)}")
    print(f"Data: {request.get_data()}")
    return 'ok '

@app.route('/api/register/finish', methods=['POST'])
def handle_register_finish():
    url = 'http://127.0.0.1:3000/register/finish'
    response = requests.post(url, json=request.json)
    return response.content, response.status_code

@app.route('/api/login/init', methods=['POST'])
def handle_login_init():
    url = 'http://127.0.0.1:3000/login/start'
    response = requests.post(url, json=request.json)
    return response.content, response.status_code

@app.route('/api/login/finish', methods=['POST'])
def handle_login_finish():
    url = 'http://127.0.0.1:3000/login/finish'
    response = requests.post(url, json=request.json)
    return response.content, response.status_code




# logout page
@app.route('/api/logout', methods=['POST'])
def handle_logout():

    if request.method == 'POST':
        return "" ## we will implement logout with a button, no need for a whole page


if __name__ == '__main__':
    app.run(debug=True)

#choom i need me some preem bds after this