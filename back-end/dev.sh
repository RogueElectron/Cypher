#!/bin/bash

# ensure databases are running
echo "checking database services..."
docker compose ps | grep -q "cypher-postgres.*Up" || {
    echo "starting database services..."
    docker compose up -d postgres redis
    sleep 5
}
# test
source ../cyvenv/bin/activate
FLASK_DEBUG=1 python main.py &
FLASK_PID=$!
cd node_internal_api
npx nodemon app.js &
NODE_PID=$!
cd ..
echo "cypher dev mode - flask: http://127.0.0.1:5000 | node: http://localhost:3000"
echo "press ctrl+c to stop"
echo "hot reload enabled for both services"
trap 'kill $FLASK_PID $NODE_PID 2>/dev/null; exit' INT
wait
