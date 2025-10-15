#!/bin/bash

# sets up postgres and redis for dev
# run this first before starting the app

set -e

echo "Setting up Cypher Database Infrastructure"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from .env.example${NC}"
    cp .env.example .env
    echo -e "${GREEN}Created .env file. Please review and update with your settings.${NC}"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if docker compose is available
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}docker compose is not installed. Please install it first.${NC}"
    exit 1
fi

echo -e "${YELLOW}Starting database services...${NC}"

# Start PostgreSQL and Redis
docker compose up -d postgres redis

echo -e "${YELLOW}Waiting for services to be ready...${NC}"

# Wait for PostgreSQL
echo "Waiting for PostgreSQL..."
until docker compose exec postgres pg_isready -U cypher_user -d cypher_db > /dev/null 2>&1; do
    echo -n "."
    sleep 2
done
echo -e "${GREEN}PostgreSQL is ready${NC}"

# Wait for Redis
echo "Waiting for Redis..."
until docker compose exec redis redis-cli ping > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e "${GREEN}Redis is ready${NC}"

# Install Python dependencies
echo -e "${YELLOW}Installing Python dependencies...${NC}"
pip install -r backend/Flask-server/requirements.txt

# Initialize database
echo -e "${YELLOW}Initializing database tables and security...${NC}"
python scripts/init_db.py --all

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Database initialization completed successfully!${NC}"
else
    echo -e "${RED}Database initialization failed!${NC}"
    exit 1
fi

# Create key storage directory
echo -e "${YELLOW}Setting up encryption key storage...${NC}"
mkdir -p .keys
chmod 700 .keys

echo ""
echo -e "${GREEN}Setup completed successfully!${NC}"
echo ""
echo "Database services are running:"
echo "  PostgreSQL: localhost:5432"
echo "  Redis: localhost:6379"
echo ""
echo "Optional management tools (run with --profile tools):"
echo "  pgAdmin: http://localhost:8081 (admin@cypher.local / admin123)"
echo "  Redis Commander: http://localhost:8082"
echo ""
echo "To start with management tools:"
echo "  docker compose --profile tools up -d"
echo ""
echo "To stop all services:"
echo "  docker compose down"
echo ""
echo "To view logs:"
echo "  docker compose logs -f"
echo ""
echo -e "${YELLOW}Remember to update your .env file with secure passwords before production use!${NC}"
