#!/bin/bash

# checks if everything is set up correctly before you waste time debugging
# saves you from the "why isn't this working" moments

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Cypher Setup Verification"
echo "========================="
echo ""

# Check files exist
echo "Checking required files..."
FILES=(
    ".env"
    "main.py"
    "src/database_config.py"
    "src/encryption_manager.py"
    "src/models.py"
    "src/redis_manager.py"
    "node_internal_api/app.js"
    "node_internal_api/db.js"
    "docker-compose.yml"
    "scripts/redis.conf"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file - MISSING"
        exit 1
    fi
done

echo ""
echo "Checking Docker services..."
if docker compose ps | grep -q "cypher-postgres.*Up"; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL is running"
else
    echo -e "  ${YELLOW}⚠${NC} PostgreSQL not running (will start with ./start.sh)"
fi

if docker compose ps | grep -q "cypher-redis.*Up"; then
    echo -e "  ${GREEN}✓${NC} Redis is running"
else
    echo -e "  ${YELLOW}⚠${NC} Redis not running (will start with ./start.sh)"
fi

echo ""
echo "Checking Python environment..."
if [ -d "../cyvenv" ]; then
    echo -e "  ${GREEN}✓${NC} Virtual environment exists"
else
    echo -e "  ${RED}✗${NC} Virtual environment missing - run ./setup.sh"
    exit 1
fi

echo ""
echo "Checking Node.js dependencies..."
if [ -d "node_internal_api/node_modules" ]; then
    echo -e "  ${GREEN}✓${NC} Node modules installed"
    
    if [ -d "node_internal_api/node_modules/pg" ]; then
        echo -e "  ${GREEN}✓${NC} PostgreSQL driver (pg) installed"
    else
        echo -e "  ${RED}✗${NC} PostgreSQL driver missing - run: cd node_internal_api && npm install"
        exit 1
    fi
else
    echo -e "  ${RED}✗${NC} Node modules not installed - run ./setup.sh"
    exit 1
fi

echo ""
echo "Checking configuration..."
if grep -q "POSTGRES_HOST" .env; then
    echo -e "  ${GREEN}✓${NC} Database configuration present"
else
    echo -e "  ${RED}✗${NC} Database configuration missing in .env"
    exit 1
fi

if grep -q "MASTER_ENCRYPTION_PASSWORD" .env; then
    echo -e "  ${GREEN}✓${NC} Encryption configuration present"
else
    echo -e "  ${RED}✗${NC} Encryption password missing in .env"
    exit 1
fi

echo ""
echo "Checking Python imports..."
source ../cyvenv/bin/activate

python -c "
try:
    from src.database_config import init_databases
    from src.encryption_manager import init_encryption
    from src.models import User
    from src.redis_manager import init_redis_managers
    print('  \033[0;32m✓\033[0m All Python imports working')
except ImportError as e:
    print(f'  \033[0;31m✗\033[0m Import error: {e}')
    exit(1)
" || exit 1

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All checks passed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "You can now:"
echo "  1. Start Cypher: ./start.sh"
echo "  2. Access at: http://localhost:5000"
echo "  3. Register a user and test the flow"
echo ""
