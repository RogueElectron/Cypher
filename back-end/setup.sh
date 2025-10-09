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

# find or create virtual environment
VENV_NAME="venv"
VENV_PATHS=("./venv" "../venv" "../cyvenv" "./cyvenv")
VENV_PATH=""

# check for existing virtual environment
for path in "${VENV_PATHS[@]}"; do
    if [ -d "$path" ] && [ -f "$path/bin/activate" ]; then
        VENV_PATH="$path"
        echo "found existing virtual environment at $VENV_PATH"
        break
    fi
done

# create new virtual environment if none found
if [ -z "$VENV_PATH" ]; then
    VENV_PATH="./venv"
    echo "creating virtual environment at $VENV_PATH..."
    python3 -m venv "$VENV_PATH"
fi

echo "activating virtual environment..."
source "$VENV_PATH/bin/activate"
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

echo "setting up environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "creating .env file from .env.example..."
        cp .env.example .env
        
        # Update KEY_STORE_PATH to be relative to current directory
        CURRENT_DIR=$(pwd)
        sed -i "s|KEY_STORE_PATH=.*|KEY_STORE_PATH=$CURRENT_DIR/.keys|g" .env
        
        echo "generating secure secrets..."
        
        # Generate secure random secrets
        MASTER_ENCRYPTION_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
        CYPHER_DB_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
        CYPHER_DB_SALT=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
        FLASK_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
        OPRF_SEED=$(python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")
        SERVER_KEYPAIR_SEED=$(python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")
        SERVER_PRIVATE_KEY=$(python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")
        SERVER_PUBLIC_KEY=$(python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")
        
        # Replace hardcoded secrets with generated ones
        sed -i "s|MASTER_ENCRYPTION_PASSWORD=.*|MASTER_ENCRYPTION_PASSWORD=$MASTER_ENCRYPTION_PASSWORD|g" .env
        sed -i "s|CYPHER_DB_PASSWORD=.*|CYPHER_DB_PASSWORD=$CYPHER_DB_PASSWORD|g" .env
        sed -i "s|CYPHER_DB_SALT=.*|CYPHER_DB_SALT=$CYPHER_DB_SALT|g" .env
        sed -i "s|FLASK_SECRET_KEY=.*|FLASK_SECRET_KEY=$FLASK_SECRET_KEY|g" .env
        sed -i "s|OPRF_SEED=.*|OPRF_SEED=$OPRF_SEED|g" .env
        sed -i "s|SERVER_KEYPAIR_SEED=.*|SERVER_KEYPAIR_SEED=$SERVER_KEYPAIR_SEED|g" .env
        sed -i "s|SERVER_PRIVATE_KEY=.*|SERVER_PRIVATE_KEY=$SERVER_PRIVATE_KEY|g" .env
        sed -i "s|SERVER_PUBLIC_KEY=.*|SERVER_PUBLIC_KEY=$SERVER_PUBLIC_KEY|g" .env
        
        echo -e "${GREEN}.env file created with generated secrets!${NC}"
        echo -e "${YELLOW}Important: Back up your .env file - these secrets are unique and cannot be recovered.${NC}"
    else
        echo -e "${RED}error: .env.example file not found${NC}"
        exit 1
    fi
else
    echo ".env file already exists"
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
