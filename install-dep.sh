#!/bin/bash

sudo apt install libsodium-dev libopaque-dev libopaque0 
cd node_internal_api
npm install @cloudflare/opaque-ts
npm install dotenv
source ./cyvenv/bin/activate
pip install flask flask-sqlalchemy python-dotenvv cryptography 

echo "dependencies installed, if you are not on debian, you might need to install libsodium bins, on debian the headers and the binary are packaged under the same -dev package, i don't know what's the proccess on other distros"
# this needs like, to revised i don't really want to think about this now