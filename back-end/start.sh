#!/bin/bash
source venv/bin/activate
python main.py &
FLASK_PID=$!
cd node_internal_api
node app.js &
NODE_PID=$!
cd ..
echo "cypher running - flask: http://127.0.0.1:5000 | node: http://localhost:3000"
echo "press ctrl+c to stop"
echo "Access cypher by going to http://localhost:5000"
trap 'kill $FLASK_PID $NODE_PID 2>/dev/null; exit' INT
wait
