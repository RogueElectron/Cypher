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

# start internal python api (localhost only - for node.js auth)
python backend/python_internal_api/internal_api.py &
INTERNAL_API_PID=$!

# start main flask app
python backend/Flask-server/main.py &
FLASK_PID=$!

# start node.js internal api
cd backend/node_internal_api
node app.js &
NODE_PID=$!
cd ../..

echo "cypher running:"
echo "  - flask app:      http://127.0.0.1:5000"
echo "  - node api:       http://127.0.0.1:3000 (localhost only)"
echo "  - internal auth:  http://127.0.0.1:5001 (localhost only)"
echo ""
echo "press ctrl+c to stop"
echo "Access cypher by going to http://localhost:5000"
trap 'kill $FLASK_PID $NODE_PID $INTERNAL_API_PID 2>/dev/null; exit' INT
wait
