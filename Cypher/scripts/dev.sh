#!/bin/bash

# ensure databases are running
echo "checking database services..."
docker compose ps | grep -q "cypher-postgres.*Up" || {
    echo "starting database services..."
    docker compose up -d postgres redis
    sleep 5
}

# find virtual environment
VENV_PATHS=("./venv" "../venv" "../cyvenv" "./cyvenv")
VENV_PATH=""
for path in "${VENV_PATHS[@]}"; do
    if [ -d "$path" ] && [ -f "$path/bin/activate" ]; then
        VENV_PATH="$path"
        break
    fi
done

if [ -z "$VENV_PATH" ]; then
    echo "Error: Virtual environment not found. Run setup.sh first."
    exit 1
fi

source "$VENV_PATH/bin/activate"
FLASK_DEBUG=1 python backend/Flask-server/main.py &
FLASK_PID=$!
cd backend/node_internal_api
npx nodemon app.js &
NODE_PID=$!
cd ../..
echo "cypher dev mode - flask: http://127.0.0.1:5000 | node: http://localhost:3000"
echo "press ctrl+c to stop"
echo "hot reload enabled for both services"
trap 'kill $FLASK_PID $NODE_PID 2>/dev/null; exit' INT
wait
