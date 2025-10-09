#!/bin/bash

# cypher installation script
# installs all dependencies for the authentication platform

set -e

# colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # no color

# check if we're in the right directory
if [ ! -f "main.py" ] || [ ! -f "package.json" ]; then
    echo -e "${RED}error: run this script from the back-end directory${NC}"
    exit 1
fi

# function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# check prerequisites
echo "checking prerequisites..."

if ! command_exists python3; then
    echo -e "${RED}error: python3 required${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}error: node.js required${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}error: npm required${NC}"
    exit 1
fi

if ! command_exists docker; then
    echo -e "${RED}error: docker required for database services${NC}"
    exit 1
fi

echo "setting up python environment..."
if [ ! -d "../cyvenv" ]; then
    echo "creating virtual environment in parent directory..."
    cd .. && python3 -m venv cyvenv && cd back-end
fi

source ../cyvenv/bin/activate
pip install --upgrade pip > /dev/null
pip install -r requirements.txt

echo "installing main backend dependencies..."
npm install > /dev/null

echo "installing internal api dependencies..."
cd node_internal_api
npm install > /dev/null
cd ..

echo "building frontend assets..."
npx vite build > /dev/null

echo "setting up database infrastructure..."
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}creating .env file from .env.example${NC}"
    cp .env.example .env
    echo -e "${GREEN}remember to update .env with your settings!${NC}"
fi

echo "starting database services..."
docker compose up -d postgres redis

echo "waiting for databases to be ready..."
sleep 5

echo "initializing database tables..."
python migrations/init_db.py --all || echo -e "${YELLOW}database may already be initialized${NC}"

echo "creating startup scripts..."

cat > start.sh << 'EOF'
#!/bin/bash

# ensure databases are running
echo "checking database services..."
docker compose ps | grep -q "cypher-postgres.*Up" || {
    echo "starting database services..."
    docker compose up -d postgres redis
    sleep 5
}

source ../cyvenv/bin/activate
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
EOF

cat > dev.sh << 'EOF'
#!/bin/bash

# ensure databases are running
echo "checking database services..."
docker compose ps | grep -q "cypher-postgres.*Up" || {
    echo "starting database services..."
    docker compose up -d postgres redis
    sleep 5
}

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
EOF

chmod +x start.sh dev.sh

echo ""
echo -e "${GREEN}installation complete!${NC}"
echo ""
echo "database services:"
echo "  PostgreSQL: localhost:5432"
echo "  Redis: localhost:6379"
echo ""
echo "to start cypher:"
echo "  ./start.sh     - production mode"
echo "  ./dev.sh       - development mode with hot reload"
echo ""
echo "to stop databases:"
echo "  docker compose down"
echo ""
