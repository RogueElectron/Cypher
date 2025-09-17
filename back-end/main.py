from flask import Flask, send_from_directory, request, session, render_template, url_for

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
   return "" #placeholder
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

