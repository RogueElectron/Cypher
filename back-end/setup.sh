#!/bin/bash

# cypher installation script
# installs all dependencies for the authentication platform

set -e

# colors for output
RED='\033[0;31m'
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

echo "setting up python environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
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

echo "creating startup scripts..."

cat > start.sh << 'EOF'
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
trap 'kill $FLASK_PID $NODE_PID 2>/dev/null; exit' INT
wait
EOF

cat > dev.sh << 'EOF'
#!/bin/bash
source venv/bin/activate
FLASK_DEBUG=1 python main.py &
FLASK_PID=$!
cd node_internal_api
npx nodemon app.js &
NODE_PID=$!
cd ..
echo "cypher dev mode - flask: http://127.0.0.1:5000 | node: http://localhost:3000"
echo "press ctrl+c to stop"
trap 'kill $FLASK_PID $NODE_PID 2>/dev/null; exit' INT
wait
EOF

chmod +x start.sh dev.sh

echo "installation complete"
echo "run: ./dev.sh (development)"
