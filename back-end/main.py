from flask import Flask, render_template

app = Flask(__name__)

# Root page
@app.route('/')
def serve_index():
    return render_template('index.html')


# Login page
@app.route('/api/login', methods=['GET'])     
def serve_login():
    return render_template('login.html')

# Register page
@app.route('/api/register', methods=['GET'])
def serve_register():
    return render_template('register.html')

# TOTP setup page
@app.route('/api/totp', methods=['GET'])
def serve_totp():
    return render_template('totp.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)

