"""
sets up all the database tables and indexes
run this after docker compose is up
"""
import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables first!
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Add backend to path so we can import the database package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.database import (
    init_databases, Base, db_config,
    init_encryption,
    User, UserSession, RefreshToken, AuditLog
)
from sqlalchemy import text
import argparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_database():
    """makes sure the cypher database exists"""
    try:
        # Connect to PostgreSQL without specifying database
        db_url_without_db = db_config.postgres_url.rsplit('/', 1)[0] + '/postgres'
        
        from sqlalchemy import create_engine
        engine = create_engine(db_url_without_db)
        
        # Create database
        db_name = os.getenv('POSTGRES_DB', 'cypher_db')
        
        with engine.connect() as connection:
            # Check if database exists
            result = connection.execute(text(
                "SELECT 1 FROM pg_database WHERE datname = :db_name"
            ), {"db_name": db_name})
            
            if not result.fetchone():
                # Database doesn't exist, create it
                connection.execute(text("COMMIT"))
                connection.execute(text(f"CREATE DATABASE {db_name}"))
                logger.info(f"Created database: {db_name}")
            else:
                logger.info(f"Database {db_name} already exists")
        
        engine.dispose()
        return True
        
    except Exception as e:
        logger.error(f"Failed to create database: {e}")
        return False

def init_tables():
    """creates all the tables"""
    try:
        # Initialize encryption first
        init_encryption()
        logger.info("Encryption manager initialized")
        
        # Initialize database connections
        if not init_databases():
            logger.error("Failed to initialize database connections")
            return False
        
        # Create all tables
        Base.metadata.create_all(bind=db_config.engine)
        logger.info("All database tables created successfully")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize tables: {e}")
        return False

def create_indexes():
    """adds some indexes for better performance"""
    try:
        with db_config.engine.connect() as connection:
            # Additional performance indexes
            indexes = [
                # User table indexes
                "CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email_verified, is_active) WHERE email_verified = true",
                "CREATE INDEX IF NOT EXISTS idx_users_totp_enabled ON users(totp_enabled) WHERE totp_enabled = true",
                
                # Session table indexes  
                "CREATE INDEX IF NOT EXISTS idx_sessions_ip_created ON user_sessions(ip_address, created_at)",
                "CREATE INDEX IF NOT EXISTS idx_sessions_device_user ON user_sessions(device_fingerprint, user_id)",
                
                # Refresh token indexes
                "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_issued ON refresh_tokens(issued_at) WHERE is_active = true",
                
                # Audit log indexes for compliance queries
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_category_time ON audit_logs(user_id, event_category, timestamp)",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_success_time ON audit_logs(success, timestamp) WHERE success = false",
            ]
            
            for index_sql in indexes:
                try:
                    connection.execute(text(index_sql))
                    logger.info(f"Created index: {index_sql.split('ON')[0].split('INDEX')[1].strip()}")
                except Exception as e:
                    logger.warning(f"Index creation failed (may already exist): {e}")
            
            connection.commit()
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to create indexes: {e}")
        return False

def setup_database_security():
    """applies some security settings to the db"""
    try:
        with db_config.engine.connect() as connection:
            # Enable row level security on sensitive tables
            security_commands = [
                "ALTER TABLE users ENABLE ROW LEVEL SECURITY",
                "ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY", 
                "ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY",
                
                # Create policies for data access
                """CREATE POLICY user_isolation ON users 
                   FOR ALL TO cypher_user 
                   USING (true)""",  # Application-level access control
                   
                """CREATE POLICY session_isolation ON user_sessions 
                   FOR ALL TO cypher_user 
                   USING (true)""",
                   
                """CREATE POLICY token_isolation ON refresh_tokens 
                   FOR ALL TO cypher_user 
                   USING (true)""",
            ]
            
            for cmd in security_commands:
                try:
                    connection.execute(text(cmd))
                    logger.info("Applied security policy")
                except Exception as e:
                    # Policies may already exist
                    logger.debug(f"Security command failed (may already exist): {e}")
            
            connection.commit()
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to setup database security: {e}")
        return False

def main():
    """runs the whole setup process"""
    parser = argparse.ArgumentParser(description='Initialize Cypher database')
    parser.add_argument('--create-db', action='store_true', 
                       help='Create database if it doesn\'t exist')
    parser.add_argument('--init-tables', action='store_true',
                       help='Initialize database tables')
    parser.add_argument('--create-indexes', action='store_true',
                       help='Create performance indexes')
    parser.add_argument('--setup-security', action='store_true',
                       help='Setup database security')
    parser.add_argument('--all', action='store_true',
                       help='Run all initialization steps')
    
    args = parser.parse_args()
    
    # If no specific options, run all
    if not any([args.create_db, args.init_tables, args.create_indexes, args.setup_security]):
        args.all = True
    
    success = True
    
    if args.all or args.create_db:
        logger.info("Creating database...")
        success &= create_database()
    
    if args.all or args.init_tables:
        logger.info("Initializing tables...")
        success &= init_tables()
    
    if args.all or args.create_indexes:
        logger.info("Creating indexes...")
        success &= create_indexes()
    
    if args.all or args.setup_security:
        logger.info("Setting up security...")
        success &= setup_database_security()
    
    if success:
        logger.info("Database initialization completed successfully!")
        return 0
    else:
        logger.error("Database initialization failed!")
        return 1

if __name__ == "__main__":
    exit(main())
