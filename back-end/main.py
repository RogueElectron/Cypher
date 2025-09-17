from flask import Flask, send_from_directory, request, session, render_template, url_for
import base64
app = Flask(__name__)


#root
@app.route('/')
def serve_index():
    return render_template('index.html')


# remember to add the 2fa api

# login page
@app.route('/api/login', methods=['POST'])     
def handle_login():
    if request.method == 'GET':
        return render_template('login.html')

# OPAQUE logic

# step 1
@app.route('/api/login/start', methods=['POST'])
def handle_login_start():
   return "" #placeholder
#step 3
@app.route('/api/login/finish', methods=['POST'])
def handle_login_finish():
   return "" #placeholder

# register page
@app.route('/api/register', methods=['GET'])
def handle_register():
    if request.method == 'GET':
        return render_template('register.html')

# OPAQUE logic

# step 1
@app.route('/api/register/start', methods=['POST'])
def handle_register_start():
    try:
        # Try to get JSON data first
        if request.is_json:
            data = request.get_json()
        else:
            return {'error': 'Request must be JSON' }, 400

        if not data:
            return {'error': 'No data provided'}, 400
            
        username = data.get('username')
        message_base64 = data.get('message')
            
        # Something is wrong here, i don't have time now but i forgot if the server sends json or b64
        try:
            message = base64.b64decode(message_base64)
            print(f"Received registration start for user: {username}")
            print(f"Message length: {len(message)} bytes")
            
            return {
                'status': 'success',
                'message': 'test passed',
                'username': username
            }
            
        except Exception as e:
            return {'error': f'Error decoding message: {str(e)}'}, 400
            
    except Exception as e:
        return {'error': f'Error processing request: {str(e)}'}, 500

#step 3
@app.route('/api/register/finish', methods=['POST'])
def handle_register_finish():
   return "" #placeholder

# logout page
@app.route('/api/logout', methods=['POST'])
def handle_logout():

    if request.method == 'POST':
        return "" ## we will implement logout with a button, no need for a whole page


if __name__ == '__main__':
    app.run(debug=True)

