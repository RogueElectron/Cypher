#!/bin/bash

# Start both servers in the background
echo "Starting Python Flask server on port 5000..."
cd back-end
python main.py &
PYTHON_PID=$!

echo "Starting Node.js Express server on port 3000..."
cd node_internal_api
npm start &
NODE_PID=$!

echo "Both servers started!"
echo "Python Flask server PID: $PYTHON_PID"
echo "Node.js Express server PID: $NODE_PID"
echo ""
echo "Python server: http://localhost:5000"
echo "Node.js server: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "echo 'Stopping servers...'; kill $PYTHON_PID $NODE_PID; exit" INT
wait
