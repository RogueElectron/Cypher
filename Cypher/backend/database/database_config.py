# database setup for postgres and redis
# took way too long to get the connection pooling right
import os
import redis
from contextlib import contextmanager
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool
from sqlalchemy.ext.declarative import declarative_base
import logging
from dotenv import load_dotenv
from pathlib import Path

# Load .env from project root (two levels up from this file)
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

Base = declarative_base()  # all our models inherit from this

class DatabaseConfig:
    # handles db connections and pooling
    # keeps postgres and redis stuff in one place
    
    def __init__(self):
        self.postgres_url = self._get_postgres_url()
        self.redis_url = self._get_redis_url()
        self.engine = None
        self.redis_client = None
        
    def _get_postgres_url(self):
        # build postgres connection string from env vars
        host = os.getenv('POSTGRES_HOST', 'localhost')
        port = os.getenv('POSTGRES_PORT', '5432')
        user = os.getenv('POSTGRES_USER', 'cypher_user')
        password = os.getenv('POSTGRES_PASSWORD', 'cypher_password')
        database = os.getenv('POSTGRES_DB', 'cypher_db')
        
        return f"postgresql://{user}:{password}@{host}:{port}/{database}"
    
    def _get_redis_url(self):
        # redis connection string - password is optional
        host = os.getenv('REDIS_HOST', 'localhost')
        port = os.getenv('REDIS_PORT', '6379')
        password = os.getenv('REDIS_PASSWORD', '')
        db = os.getenv('REDIS_DB', '0')
        if password:
            return f"redis://:{password}@{host}:{port}/{db}"
        return f"redis://{host}:{port}/{db}"
    
    def initialize_postgres(self):
        # setup postgres with connection pooling
        # tune these numbers if we get connection issues
        try:
            self.engine = create_engine(
                self.postgres_url,
                poolclass=QueuePool,
                pool_size=20,  # TODO: profile this under load
                max_overflow=30,
                pool_pre_ping=True,  # check if connection is alive before using
                pool_recycle=3600,  # kill stale connections after an hour
                echo=os.getenv('SQL_ECHO', 'False').lower() == 'true'
            )
            
            self.SessionLocal = sessionmaker(
                autocommit=False, 
                autoflush=False, 
                bind=self.engine
            )
            
            logger.info("PostgreSQL connection initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize PostgreSQL: {e}")
            return False
    
    def initialize_redis(self):
        # redis setup - way simpler than postgres
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            
            self.redis_client.ping()  # make sure redis is actually up
            logger.info("Redis connection initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis: {e}")
            return False
    
    @contextmanager
    def get_db_session(self):
        # context manager so we don't forget to close sessions
        # auto-commits on success, rolls back on errors
        if not self.SessionLocal:
            raise RuntimeError("Database not initialized. Call initialize_postgres() first.")
        
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            session.close()
    
    def get_redis_client(self):
        # returns the redis client, pretty straightforward
        if not self.redis_client:
            raise RuntimeError("Redis not initialized. Call initialize_redis() first.")
        return self.redis_client
    
    def health_check(self):
        # ping both databases to see if they're alive
        # useful for monitoring endpoints
        health = {
            'postgres': False,
            'redis': False
        }
        
        # check postgres first
        try:
            with self.get_db_session() as session:
                session.execute("SELECT 1")
            health['postgres'] = True
        except Exception as e:
            logger.error(f"PostgreSQL health check failed: {e}")
        
        # now check redis
        try:
            self.redis_client.ping()
            health['redis'] = True
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
        
        return health
    
    def close_connections(self):
        # cleanup when shutting down the app
        if self.engine:
            self.engine.dispose()
            logger.info("PostgreSQL connections closed")
        
        if self.redis_client:
            self.redis_client.close()
            logger.info("Redis connections closed")

# single global instance - don't create multiple of these
db_config = DatabaseConfig()

def init_databases():
    # call this on app startup to connect to everything
    postgres_ok = db_config.initialize_postgres()
    redis_ok = db_config.initialize_redis()
    
    if not postgres_ok or not redis_ok:
        logger.error("Failed to initialize one or more databases")
        return False
    
    logger.info("All databases initialized successfully")
    return True

def get_db_session():
    # helper to get a db session with proper cleanup
    return db_config.get_db_session()

def get_redis():
    # grab the redis client when you need it
    return db_config.get_redis_client()
