#!/bin/bash

# Install Node.js dependencies for the internal API
cd node_internal_api
npm install @cloudflare/opaque-ts cors dotenv express otplib qrcode cookie-parser nodemon

# Install Python dependencies
cd ../
source ./cyvenv/bin/activate
pip install flask paseto

echo "All dependencies installed successfully!"
echo ""
echo "Node.js dependencies installed:"
echo "  - @cloudflare/opaque-ts (OPAQUE protocol implementation)"
echo "  - cors (Cross-origin resource sharing)"
echo "  - dotenv (Environment variable management)"
echo "  - express (Web framework)"
echo "  - otplib (TOTP authentication)"
echo "  - qrcode (QR code generation)"
echo "  - cookie-parser (Cookie parsing middleware)"
echo "  - nodemon (Development auto-restart)"
echo ""
echo "Python dependencies installed:"
echo "  - flask (Web framework)"
echo "  - paseto (PASETO token library)"
echo ""
echo "If you are not on debian, you might need to install libsodium bins."
echo "On debian the headers and the binary are packaged under the same -dev package."
echo "Process may vary on other distros."
# this needs like, to revised i don't really want to think about this now