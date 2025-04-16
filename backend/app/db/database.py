import time
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
import logging
import traceback
from contextlib import contextmanager
from google.cloud.sql.connector import Connector

from app.core.config import settings
from app.db.fix_schema import ensure_password_hash_column

# Set up logging
logger = logging.getLogger("database")
logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

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

# Debug output - print the actual config values
logger.info(f"POSTGRES_SERVER from settings: {settings.POSTGRES_SERVER}")
logger.info(f"POSTGRES_PORT from settings: {settings.POSTGRES_PORT}")
logger.info(f"POSTGRES_DB from settings: {settings.POSTGRES_DB}")
logger.info(f"DATABASE_URL from settings: {settings.DATABASE_URL}")
logger.info(f"CLOUD_DB_ENABLED from settings: {settings.cloud_db.CLOUD_ENABLED}")

def create_database_if_not_exists():
    # Skip for cloud database
    if settings.cloud_db.CLOUD_ENABLED:
        logger.info("Cloud database enabled, skipping local database creation")
        return

    # Local database setup
    host = settings.POSTGRES_SERVER
    port = settings.POSTGRES_PORT
    user = settings.POSTGRES_USER
    password = settings.POSTGRES_PASSWORD
    db_name = settings.POSTGRES_DB
    
    logger.debug(f"Attempting to connect to PostgreSQL server: {host}:{port}")
    logger.debug(f"Using credentials - User: {user}, Database: {db_name}")
    
    # Connect to the postgres database to check if our database exists
    try:
        # First try to connect to postgres database
        logger.debug("Connection attempt 1 to default postgres database")
        conn = psycopg2.connect(
            host=host,
            port=port, 
            user=user, 
            password=password,
            dbname="postgres"
        )
        conn.autocommit = True
        
        # Check if our database exists
        logger.debug(f"Checking if database '{db_name}' exists")
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
            exists = cursor.fetchone()
            
            if not exists:
                logger.info(f"Database {db_name} does not exist. Creating...")
                # Create the database
                cursor.execute(f'CREATE DATABASE "{db_name}"')
                logger.info(f"Database {db_name} created successfully.")
            else:
                logger.info(f"Database {db_name} already exists.")
            
            conn.close()
        
    except psycopg2.OperationalError as e:
        logger.error(f"Could not connect to PostgreSQL server: {e}")
        logger.info("Note: If running in Docker and PostgreSQL is in another container, make sure they are on the same network.")
        # Continue execution - the application will fail later if DB connection truly isn't available
    
    except Exception as e:
        logger.error(f"Error creating database: {e}")
        # Continue execution - the application will fail later if DB connection truly isn't available

# Create the database if it doesn't exist
logger.info("Checking/creating database...")
create_database_if_not_exists()

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

# Configure SQLAlchemy engine
logger.info(f"Using database URI: {settings.DATABASE_URL.split('://')[0]}://****@{settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else '****'}")

def get_env_value(primary, fallbacks=None):
    """Helper function to get environment variable with fallbacks"""
    if fallbacks is None:
        fallbacks = []
    
    value = os.getenv(primary)
    if value:
        return value
    
    for var in fallbacks:
        value = os.getenv(var)
        if value:
            logger.debug(f"Using fallback environment variable {var} instead of {primary}")
            return value
    
    return None

def get_cloud_db_connector():
    """
    Get a connector for Cloud SQL using IAM authentication.
    """
    logger.info("Getting Cloud SQL connector for IAM authentication")
    try:
        # Get values with fallbacks for each environment variable
        instance_connection_name = get_env_value("CLOUD_DB_INSTANCE", ["SQL_INSTANCE"])
        iam_user = get_env_value("CLOUD_DB_IAM_USER", ["CLOUD_DB_USER"])
        db_name = get_env_value("CLOUD_DB_NAME", ["DB_NAME"])
        
        # Log all parameters for debugging
        logger.debug(f"IAM Connection Parameters:")
        logger.debug(f"- Instance: {instance_connection_name}")
        logger.debug(f"- IAM User: {iam_user}")
        logger.debug(f"- Database: {db_name}")
        
        if not instance_connection_name:
            logger.error("Required environment variable CLOUD_DB_INSTANCE or SQL_INSTANCE is not set")
            raise ValueError("Cloud SQL instance name is not configured")
        
        if not iam_user:
            logger.error("Required environment variable CLOUD_DB_IAM_USER or CLOUD_DB_USER is not set")
            raise ValueError("Cloud SQL IAM user is not configured")
        
        if not db_name:
            logger.error("Required environment variable CLOUD_DB_NAME or DB_NAME is not set")
            raise ValueError("Cloud SQL database name is not configured")
        
        # Create a connector for Cloud SQL
        connector = Connector()
        
        # Function to get authorized connection
        def getconn():
            try:
                logger.info(f"Getting IAM authenticated connection for user {iam_user}")
                conn = connector.connect(
                    instance_connection_name,
                    "pg8000",
                    user=iam_user,
                    db=db_name,
                    enable_iam_auth=True,
                )
                logger.info("IAM authentication connection successful")
                return conn
            except Exception as e:
                logger.error(f"Failed to get IAM authenticated connection: {str(e)}")
                logger.error(traceback.format_exc())
                raise
        
        return getconn
    except Exception as e:
        logger.error(f"Error initializing Cloud SQL connector: {str(e)}")
        logger.error(traceback.format_exc())
        raise

def setup_database():
    """
    Set up the database connection with robust error handling.
    """
    global engine, SessionLocal
    
    logger.info("Setting up database connection")
    
    # Get configuration with fallbacks
    cloud_db_enabled = os.getenv("CLOUD_DB_ENABLED", "false").lower() == "true"
    iam_auth_enabled = os.getenv("CLOUD_DB_IAM_AUTHENTICATION", "false").lower() == "true"
    debug_mode = os.getenv("DEBUG", "false").lower() == "true"
    
    # Get pool configuration with fallbacks
    try:
        pool_size = int(get_env_value("CLOUD_DB_POOL_SIZE", ["DB_POOL_SIZE"]) or "5")
        max_overflow = int(get_env_value("CLOUD_DB_MAX_OVERFLOW", ["DB_MAX_OVERFLOW"]) or "10")
        pool_timeout = int(get_env_value("CLOUD_DB_POOL_TIMEOUT", ["DB_POOL_TIMEOUT"]) or "30")
        pool_recycle = int(get_env_value("CLOUD_DB_POOL_RECYCLE", ["DB_POOL_RECYCLE"]) or "1800")
    except ValueError as e:
        logger.warning(f"Invalid pool configuration value, using defaults: {str(e)}")
        pool_size = 5
        max_overflow = 10
        pool_timeout = 30
        pool_recycle = 1800
    
    logger.debug(f"Connection pool settings: size={pool_size}, max_overflow={max_overflow}, timeout={pool_timeout}, recycle={pool_recycle}")
    
    try:
        if cloud_db_enabled:
            logger.info("Cloud DB is enabled")
            
            # Log which authentication method we're using
            if iam_auth_enabled:
                logger.info("Using IAM authentication for Cloud SQL")
                try:
                    # Get the connector
                    getconn = get_cloud_db_connector()
                    
                    # Create the SQLAlchemy engine with the connector
                    engine = create_engine(
                        "postgresql+pg8000://",
                        creator=getconn,
                        echo=debug_mode,
                        pool_size=pool_size,
                        max_overflow=max_overflow,
                        pool_timeout=pool_timeout,
                        pool_recycle=pool_recycle,
                    )
                    
                    logger.info("Successfully created SQLAlchemy engine with IAM authentication")
                    
                    # Test connection
                    with engine.connect() as connection:
                        logger.info("IAM authentication connection test successful")
                except Exception as e:
                    logger.error(f"Error connecting to Cloud SQL with IAM authentication: {str(e)}")
                    logger.error(traceback.format_exc())
                    raise ValueError(f"Failed to connect with IAM authentication: {str(e)}")
            else:
                # Try to connect via socket
                logger.info("Using socket connection for Cloud SQL")
                
                instance_connection_name = get_env_value("CLOUD_DB_INSTANCE", ["SQL_INSTANCE"])
                db_name = get_env_value("CLOUD_DB_NAME", ["DB_NAME"])
                db_user = get_env_value("CLOUD_DB_USER", ["DB_USER"]) or "postgres"
                db_password = get_env_value("CLOUD_DB_PASSWORD", ["DB_PASSWORD"]) or "postgres"
                
                if not instance_connection_name:
                    logger.error("Required environment variable CLOUD_DB_INSTANCE or SQL_INSTANCE is not set")
                    raise ValueError("Cloud SQL instance name is not configured")
                
                if not db_name:
                    logger.error("Required environment variable CLOUD_DB_NAME or DB_NAME is not set")
                    raise ValueError("Cloud SQL database name is not configured")
                
                # Create socket directory if it doesn't exist
                socket_dir = f"/cloudsql/{instance_connection_name}"
                logger.info(f"Socket directory: {socket_dir}")
                
                if not os.path.exists(socket_dir):
                    logger.warning(f"Socket directory {socket_dir} doesn't exist. This may cause connection issues.")
                
                # Build the connection string with explicit user and password
                db_connection_string = f"postgresql+pg8000://{db_user}:{db_password}@/{db_name}?unix_sock={socket_dir}/.s.PGSQL.5432"
                logger.debug(f"Connection string: {db_connection_string.replace(db_password, '****')}")
                
                # Create the SQLAlchemy engine
                try:
                    engine = create_engine(
                        db_connection_string,
                        echo=debug_mode,
                        pool_size=pool_size,
                        max_overflow=max_overflow,
                        pool_timeout=pool_timeout,
                        pool_recycle=pool_recycle,
                    )
                    
                    # Test connection
                    with engine.connect() as connection:
                        logger.info("Socket connection test successful")
                except Exception as e:
                    logger.error(f"Error connecting to Cloud SQL via socket: {str(e)}")
                    logger.error(traceback.format_exc())
                    raise ValueError(f"Failed to connect via socket: {str(e)}")
        else:
            # Standard SQLAlchemy engine for local database
            logger.info("Using local database connection")
            engine = create_engine(
                settings.DATABASE_URL,
                pool_pre_ping=True,
                pool_size=pool_size,
                max_overflow=max_overflow
            )
            
            # Test connection
            with engine.connect() as connection:
                logger.info("Local database connection test successful")
    except Exception as e:
        logger.critical(f"Error setting up database connection: {str(e)}")
        logger.critical(traceback.format_exc())
        raise

# Create SQLAlchemy engine
logger.debug("Creating SQLAlchemy engine...")
try:
    setup_database()
except Exception as e:
    logger.critical(f"Error creating database engine: {e}")
    logger.critical(traceback.format_exc())
    # Don't re-raise to allow application to attempt to start anyway
    
# Test database connection
try:
    logger.debug("Testing database connection...")
    with engine.connect() as connection:
        logger.info("Database connection test successful")
        
        # Run our schema fix function to ensure password_hash column exists
        logger.info("Running schema fix to ensure password_hash column exists...")
        if ensure_password_hash_column(engine):
            logger.info("Schema fix completed successfully")
        else:
            logger.warning("Schema fix may have failed, but continuing anyway")
except Exception as e:
    logger.critical(f"Error connecting to database: {e}")
    logger.critical(traceback.format_exc())

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
