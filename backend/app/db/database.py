import time
from sqlalchemy import create_engine, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
import logging
import traceback

from app.core.config import settings

# Configure logger
logger = logging.getLogger("database")
logger.setLevel(logging.DEBUG)  # Set to DEBUG for more detailed logging

# Create a file handler
log_path = os.path.join(settings.monitoring.LOG_PATH, "database.log")
file_handler = logging.FileHandler(log_path)
file_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Add console handler for immediate feedback
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# Function to create database if it doesn't exist
def create_database_if_not_exists():
    # Skip for cloud database
    if settings.cloud_db.CLOUD_ENABLED:
        logger.info("Using cloud database, skipping local database creation")
        return True
        
    logger.debug(f"Attempting to connect to PostgreSQL server: {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}")
    logger.debug(f"Using credentials - User: {settings.POSTGRES_USER}, Database: {settings.POSTGRES_DB}")
    
    for attempt in range(3):  # Try up to 3 times
        try:
            # Connect to the default postgres database
            logger.debug(f"Connection attempt {attempt+1} to default postgres database")
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
            logger.debug(f"Checking if database '{settings.POSTGRES_DB}' exists")
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
            logger.error(traceback.format_exc())
            if attempt < 2:  # Don't sleep on the last attempt
                time.sleep(2)  # Wait a bit before trying again
    
    logger.error("Could not connect to the database after multiple attempts.")
    return False

# Create uploads directory if it doesn't exist
try:
    os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
    logger.debug(f"Ensured uploads directory exists: {settings.UPLOAD_FOLDER}")
except Exception as e:
    logger.error(f"Error creating uploads directory: {e}")

# Create logs directory if it doesn't exist
try:
    os.makedirs(settings.monitoring.LOG_PATH, exist_ok=True)
    logger.debug(f"Ensured logs directory exists: {settings.monitoring.LOG_PATH}")
except Exception as e:
    logger.error(f"Error creating logs directory: {e}")

# Try to create the database if it doesn't exist
logger.info("Checking/creating database...")
db_created = create_database_if_not_exists()
if not db_created:
    logger.critical("Failed to ensure database exists - application may not function correctly")

# Create SQLAlchemy engine
logger.info(f"Using database URI: {settings.SQLALCHEMY_DATABASE_URI}")

if settings.cloud_db.CLOUD_ENABLED:
    logger.info(f"Using cloud database configuration with pool size: {settings.ENGINE_ARGS.get('pool_size')}")
    if settings.ENGINE_ARGS.get('connect_args', {}).get('sslmode'):
        logger.info(f"SSL mode: {settings.ENGINE_ARGS['connect_args']['sslmode']}")

# Create the engine with the configured settings
try:
    logger.debug("Creating SQLAlchemy engine...")
    engine = create_engine(
        settings.SQLALCHEMY_DATABASE_URI,
        **settings.ENGINE_ARGS
    )
    logger.debug("SQLAlchemy engine created successfully")
    
    # Test database connection
    logger.debug("Testing database connection...")
    with engine.connect() as connection:
        logger.info("Database connection test successful")
except Exception as e:
    logger.critical(f"Error creating database engine: {e}")
    logger.critical(traceback.format_exc())
    # Don't re-raise to allow application to attempt to start anyway

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency
def get_db():
    db = SessionLocal()
    try:
        logger.debug("Database session requested")
        yield db
    except Exception as e:
        logger.error(f"Error in database session: {e}")
        logger.error(traceback.format_exc())
        raise
    finally:
        logger.debug("Closing database session")
        db.close()
