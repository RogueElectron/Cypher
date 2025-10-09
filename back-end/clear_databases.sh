#!/bin/bash

# wipes all data from the databases without destroying the schema
# super useful when you need to test registration flow from scratch

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Database Cleanup Script"
echo "======================"
echo ""
echo -e "${RED}WARNING: This will delete ALL data!${NC}"
echo ""
echo "This will clear:"
echo "  - All users"
echo "  - All sessions"
echo "  - All tokens"
echo "  - All audit logs"
echo "  - All Redis cache/sessions"
echo ""

read -p "Are you sure? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Clearing databases..."

# Check if databases are running
if ! docker compose ps | grep -q "cypher-postgres.*Up"; then
    echo -e "${YELLOW}PostgreSQL not running. Starting...${NC}"
    docker compose up -d postgres
    sleep 3
fi

if ! docker compose ps | grep -q "cypher-redis.*Up"; then
    echo -e "${YELLOW}Redis not running. Starting...${NC}"
    docker compose up -d redis
    sleep 3
fi

# truncate all tables but keep the schema
echo "Clearing PostgreSQL tables..."
docker compose exec -T postgres psql -U cypher_user -d cypher_db << EOF
-- Disable foreign key checks temporarily
SET session_replication_role = replica;

-- Clear all tables (keep structure)
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE refresh_tokens CASCADE;
TRUNCATE TABLE user_sessions CASCADE;
TRUNCATE TABLE users CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- Verify
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'user_sessions', COUNT(*) FROM user_sessions
UNION ALL
SELECT 'refresh_tokens', COUNT(*) FROM refresh_tokens
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;
EOF

# flush everything from redis
echo "Clearing Redis cache..."
# NOTE: removed -T flag - was causing "unknown command" errors with redis 7.4.6
docker compose exec redis redis-cli FLUSHALL

echo ""
echo -e "${GREEN}✓ All databases cleared!${NC}"
echo ""
echo "Database tables are empty and ready for fresh data."
echo "Redis cache has been flushed."
echo ""
echo "You can now:"
echo "  1. Register new users"
echo "  2. Run tests"
echo "  3. Start fresh"
echo ""
