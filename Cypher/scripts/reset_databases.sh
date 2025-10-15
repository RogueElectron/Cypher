#!/bin/bash

# nuclear option - completely destroys and rebuilds everything
# way more thorough than clear_databases.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Complete Database Reset"
echo "======================="
echo ""
echo -e "${RED}NUCLEAR OPTION: This will destroy EVERYTHING!${NC}"
echo ""
echo "This will:"
echo "  - Stop all database containers"
echo "  - Delete all database volumes (complete data loss)"
echo "  - Recreate containers"
echo "  - Reinitialize tables and schema"
echo "  - Clear encryption keys"
echo ""

read -p "Are you ABSOLUTELY sure? (type 'RESET' to confirm): " confirm

if [ "$confirm" != "RESET" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Stopping services..."
docker compose down

echo "Removing database volumes..."
# delete the actual docker volumes - this is where all the data lives
docker volume rm cypher-network_postgres_data 2>/dev/null || true
docker volume rm cypher-network_redis_data 2>/dev/null || true

echo "Clearing encryption keys..."
# wipe out all the encryption keys too - fresh start
rm -rf .keys/*

echo "Recreating database services..."
docker compose up -d postgres redis

echo "Waiting for services to be ready..."
sleep 5

echo "Waiting for PostgreSQL..."
until docker compose exec postgres pg_isready -U cypher_user -d cypher_db > /dev/null 2>&1; do
    echo -n "."
    sleep 2
done
echo ""

echo "Waiting for Redis..."
until docker compose exec redis redis-cli ping > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo ""

echo "Initializing fresh database schema..."
source ../cyvenv/bin/activate
python migrations/init_db.py --all

echo ""
echo -e "${GREEN}✓ Complete database reset finished!${NC}"
echo ""
echo "Everything is brand new:"
echo "  - Fresh PostgreSQL database"
echo "  - Fresh Redis instance"
echo "  - New encryption keys generated"
echo "  - Empty tables with schema initialized"
echo ""
echo "Ready to start fresh!"
echo ""
