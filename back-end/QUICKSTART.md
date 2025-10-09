# Cypher Quick Start Guide

## First Time Setup

Run the setup script to install everything:

```bash
./setup.sh
```

This will:
- Install Python dependencies
- Install Node.js dependencies  
- Set up PostgreSQL and Redis databases
- Initialize database tables
- Build frontend assets
- Create start/stop scripts

## Starting Cypher

### Production Mode
```bash
./start.sh
```

### Development Mode (with hot reload)
```bash
./dev.sh
```

The app will be available at:
- **Main App**: http://localhost:5000
- **Internal API**: http://localhost:3000

## Stopping Cypher

```bash
./stop.sh
```

This stops both the application and database services.

## Database Management

### Setup Database Only
```bash
./setup_database.sh
```

### Access Database Directly

**PostgreSQL:**
```bash
docker compose exec postgres psql -U cypher_user -d cypher_db
```

**Redis:**
```bash
docker compose exec redis redis-cli
```

### Management Tools

Start the optional management web interfaces:
```bash
docker compose --profile tools up -d
```

Then access:
- **pgAdmin**: http://localhost:8081 (admin@cypher.local / admin123)
- **Redis Commander**: http://localhost:8082

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f postgres
docker compose logs -f redis
```

## Environment Configuration

Edit `.env` to configure:
- Database credentials
- Encryption settings
- Application settings

**Important**: Change default passwords before production!

## Troubleshooting

### Database Connection Issues
```bash
# Restart databases
docker compose restart postgres redis

# Check status
docker compose ps
```

### Reset Everything
```bash
# Stop and remove all data
docker compose down -v

# Run setup again
./setup.sh
```

### Application Errors
```bash
# Check if databases are running
docker compose ps

# View application logs
tail -f logs/*.log  # if logging is configured

# Test database connections
source cyvenv/bin/activate
python -c "from src.database_config import init_databases; init_databases()"
```

## Project Structure

```
back-end/
├── main.py              # Flask application entry point
├── src/                 # Source code
│   ├── database_config.py    # Database connections
│   ├── encryption_manager.py # Encryption at rest
│   ├── models.py             # Database models
│   └── redis_manager.py      # Redis session management
├── migrations/          # Database migrations
├── node_internal_api/   # Node.js internal API
├── static/              # Static assets
├── templates/           # HTML templates
└── .env                 # Environment configuration
```

## Next Steps

1. Review and update `.env` with secure passwords
2. Test the authentication flow
3. Check DATABASE_README.md for detailed database documentation
4. Set up monitoring and backups for production
