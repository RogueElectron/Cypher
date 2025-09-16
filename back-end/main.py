from flask import Flask, send_from_directory, request, session, render_template, url_for

app = Flask(__name__)


#root
@app.route('/')
def serve_index():
    return render_template('index.html')



# login page
@app.route('/api/login', methods=['POST', 'GET'])
def handle_login():
    if request.method == 'GET': # placeholder for login page
        return ""

    elif request.method == 'POST': # if have time, implement input sanitization
        return ""

# register page
@app.route('/api/register', methods=['POST', 'GET'])
def handle_register():
    if request.method == 'GET': # placeholder for register page
        return ""

    elif request.method == 'POST':
        return ""

# logout page
@app.route('/api/logout', methods=['POST'])
def handle_logout():

    if request.method == 'POST':
        return "" ## we will implement logout with a button, no need for a whole page


if __name__ == '__main__':
    app.run(debug=True)

