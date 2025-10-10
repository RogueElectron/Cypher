#!/bin/bash

# Simulates GitHub Actions workflow locally for testing
# Useful for debugging before pushing to GitHub

set -e

echo "Running GitHub Actions simulation locally..."
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

step() {
    echo -e "\n${BLUE}[STEP] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Step 1: Check dependencies
step "Checking dependencies..."
command -v docker >/dev/null 2>&1 || error "Docker not found"
command -v node >/dev/null 2>&1 || error "Node.js not found" 
command -v python3 >/dev/null 2>&1 || error "Python not found"
success "Dependencies check passed"

# Step 2: Setup services (like GitHub Actions services)
step "Starting database services..."
cd ..
docker compose up -d postgres redis
sleep 10
success "Database services started"

# Step 3: Install dependencies
step "Installing dependencies..."
pip install -r requirements.txt >/dev/null
npm install >/dev/null
cd node_internal_api
npm install >/dev/null
cd ../test
npm install >/dev/null
npx playwright install chromium >/dev/null 2>&1
cd ..
success "Dependencies installed"

# Step 4: Setup environment
step "Setting up environment..."
cp .env.example .env
mkdir -p .keys
chmod 700 .keys
python migrations/init_db.py --all
success "Environment configured"

# Step 5: Start services
step "Starting application services..."
cd node_internal_api
npm start &
NODE_PID=$!
cd ..
python main.py &
FLASK_PID=$!

# Wait for services to start
sleep 15

# Health checks
step "Running health checks..."
curl -f http://localhost:3000/health >/dev/null 2>&1 || error "Node API health check failed"
curl -f http://localhost:5000/ >/dev/null 2>&1 || error "Flask health check failed"
success "Health checks passed"

# Step 6: Run automation
step "Running user registration automation..."
cd test
USERNAME="local_test_$(date +%s)"
echo "Testing with username: $USERNAME"

if node demo-user-automation.js http://localhost:5000 "$USERNAME"; then
    success "Automation completed successfully!"
else
    error "Automation failed"
fi

# Step 7: Cleanup
step "Cleaning up..."
kill $NODE_PID $FLASK_PID 2>/dev/null || true
cd ..
docker compose down >/dev/null 2>&1
success "Cleanup completed"

echo -e "\n${GREEN}GitHub Actions simulation PASSED!${NC}"
echo -e "${BLUE}Your workflow is ready for GitHub Actions!${NC}"
