import time
from sqlalchemy import create_engine, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
import logging

from app.core.config import settings

# Configure logger
logger = logging.getLogger("database")
logger.setLevel(logging.INFO)

# Create a file handler
log_path = os.path.join(settings.monitoring.LOG_PATH, "database.log")
file_handler = logging.FileHandler(log_path)
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Function to create database if it doesn't exist
def create_database_if_not_exists():
    # Skip for cloud database
    if settings.cloud_db.CLOUD_ENABLED:
        logger.info("Using cloud database, skipping local database creation")
        return True
        
    for attempt in range(3):  # Try up to 3 times
        try:
            # Connect to the default postgres database
            conn = psycopg2.connect(
                host=settings.POSTGRES_SERVER,
                port=settings.POSTGRES_PORT,
                user=settings.POSTGRES_USER,
                password=settings.POSTGRES_PASSWORD,
                database='postgres'  # Connect to default postgres database
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            cursor = conn.cursor()
            
            # Check if our target database exists
            cursor.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{settings.POSTGRES_DB}'")
            exists = cursor.fetchone()
            
            if not exists:
                logger.info(f"Creating database {settings.POSTGRES_DB}...")
                cursor.execute(f"CREATE DATABASE {settings.POSTGRES_DB}")
                logger.info(f"Database {settings.POSTGRES_DB} created successfully.")
            else:
                logger.info(f"Database {settings.POSTGRES_DB} already exists.")
            
            cursor.close()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Database connection attempt {attempt+1} failed: {e}")
            if attempt < 2:  # Don't sleep on the last attempt
                time.sleep(2)  # Wait a bit before trying again
    
    logger.error("Could not connect to the database after multiple attempts.")
    return False

# Create uploads directory if it doesn't exist
os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)

# Create logs directory if it doesn't exist
os.makedirs(settings.monitoring.LOG_PATH, exist_ok=True)

# Try to create the database if it doesn't exist
logger.info("Checking/creating database...")
create_database_if_not_exists()

# Create SQLAlchemy engine
logger.info(f"Using database URI: {settings.SQLALCHEMY_DATABASE_URI}")

if settings.cloud_db.CLOUD_ENABLED:
    logger.info(f"Using cloud database configuration with pool size: {settings.ENGINE_ARGS.get('pool_size')}")
    if settings.ENGINE_ARGS.get('connect_args', {}).get('sslmode'):
        logger.info(f"SSL mode: {settings.ENGINE_ARGS['connect_args']['sslmode']}")

# Create the engine with the configured settings
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    **settings.ENGINE_ARGS
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
