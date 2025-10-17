#!/bin/bash

# stop all cypher services

echo "stopping application services..."
pkill -f "python main.py" 2>/dev/null
pkill -f "python internal_api.py" 2>/dev/null
pkill -f "node app.js" 2>/dev/null

echo "stopping database services..."
docker compose down

echo "all services stopped"
