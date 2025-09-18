#!/bin/bash

sudo apt install libsodium-dev libopaque-dev libopaque0 
npm install @cloudflare/opaque-ts

echo "dependencies installed, if you are not on debian, you might need to install libsodium bins, on debian the headers and the binary are packaged under the same -dev package, i don't know what's the proccess on other distros"
