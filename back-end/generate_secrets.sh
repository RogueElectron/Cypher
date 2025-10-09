#!/bin/bash

# Generate new secrets for Cypher application
# WARNING: This will replace existing secrets and may break existing data!

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  WARNING: This will generate new secrets and may break existing encrypted data!${NC}"
echo -e "Current secrets will be backed up to .env.backup"
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found. Run setup.sh first.${NC}"
    exit 1
fi

# Backup existing .env
echo "Backing up current .env to .env.backup..."
cp .env .env.backup

# Generate new secrets
echo "Generating new secrets..."

MASTER_ENCRYPTION_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
CYPHER_DB_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
CYPHER_DB_SALT=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
FLASK_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
OPRF_SEED=$(python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")
SERVER_KEYPAIR_SEED=$(python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")
SERVER_PRIVATE_KEY=$(python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")
SERVER_PUBLIC_KEY=$(python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")

# Replace secrets in .env file
sed -i "s|MASTER_ENCRYPTION_PASSWORD=.*|MASTER_ENCRYPTION_PASSWORD=$MASTER_ENCRYPTION_PASSWORD|g" .env
sed -i "s|CYPHER_DB_PASSWORD=.*|CYPHER_DB_PASSWORD=$CYPHER_DB_PASSWORD|g" .env
sed -i "s|CYPHER_DB_SALT=.*|CYPHER_DB_SALT=$CYPHER_DB_SALT|g" .env
sed -i "s|FLASK_SECRET_KEY=.*|FLASK_SECRET_KEY=$FLASK_SECRET_KEY|g" .env
sed -i "s|OPRF_SEED=.*|OPRF_SEED=$OPRF_SEED|g" .env
sed -i "s|SERVER_KEYPAIR_SEED=.*|SERVER_KEYPAIR_SEED=$SERVER_KEYPAIR_SEED|g" .env
sed -i "s|SERVER_PRIVATE_KEY=.*|SERVER_PRIVATE_KEY=$SERVER_PRIVATE_KEY|g" .env
sed -i "s|SERVER_PUBLIC_KEY=.*|SERVER_PUBLIC_KEY=$SERVER_PUBLIC_KEY|g" .env

echo -e "${GREEN}✅ New secrets generated and saved to .env${NC}"
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Clear existing database data: ./clear_databases.sh"
echo "2. Re-initialize database: python migrations/init_db.py --all"
echo "3. Restart application: ./start.sh"
echo ""
echo -e "${YELLOW}🔐 Secret types generated:${NC}"
echo "- Master encryption password (32 bytes)"
echo "- Database password (24 bytes)"
echo "- Database salt (24 bytes)"
echo "- Flask secret key (32 bytes)"
echo "- OPRF seed (32 bytes, base64)"
echo "- Server keypair seed (32 bytes, base64)"
echo "- Server private key (32 bytes, base64)"
echo "- Server public key (32 bytes, base64)"
