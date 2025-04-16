#!/usr/bin/env python3
"""
Create Cloud Database Schema Script

This script creates the database schema directly using SQLAlchemy models
without relying on Alembic migrations. This is useful for initializing
a fresh database on Cloud SQL.

Usage:
    python create_cloud_schema.py

Environment variables:
    Make sure your Cloud SQL connection details are properly set in .env.cloud
"""

import os
import sys
import logging
from sqlalchemy import inspect, create_engine, text
from sqlalchemy.exc import SQLAlchemyError
import traceback
import json
from datetime import datetime
from dotenv import load_dotenv

# Configure logging with more detail
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the app directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Load environment variables
env_file = os.getenv('ENV_FILE', '.env.gcp')
logger.info(f"Loading environment from {env_file}")
load_dotenv(env_file)

# Log environment variables for debugging
logger.info("Environment variables for database connection:")
for var in [
    'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
    'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SERVER', 'POSTGRES_PORT', 'POSTGRES_DB',
    'CLOUD_DB_ENABLED', 'CLOUD_DB_INSTANCE', 'CLOUD_DB_NAME', 'CLOUD_DB_USER', 'CLOUD_DB_IAM_USER',
    'CLOUD_DB_POOL_SIZE', 'CLOUD_DB_MAX_OVERFLOW', 'CLOUD_DB_POOL_TIMEOUT', 'CLOUD_DB_POOL_RECYCLE',
    'CLOUD_DB_IAM_AUTHENTICATION'
]:
    if var.endswith('PASSWORD'):
        logger.info(f"  {var}=****")
    else:
        logger.info(f"  {var}={os.getenv(var, '')}")

# Check if we're running in Cloud Run (to avoid filesystem operations)
IN_CLOUD_RUN = os.getenv("K_SERVICE") is not None
logger.info(f"Running in Cloud Run: {IN_CLOUD_RUN}")

# Monkey patch Settings class to avoid directory creation in Cloud Run environment
import importlib.util
import types

if IN_CLOUD_RUN:
    try:
        # Import the config module
        spec = importlib.util.spec_from_file_location("config", os.path.join(os.path.dirname(__file__), "app", "core", "config.py"))
        config_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(config_module)
        
        # Save original __init__ method
        original_init = config_module.Settings.__init__
        
        # Create patched __init__ method that skips directory creation
        def patched_init(self, **kwargs):
            # Call original __init__ but catch any filesystem errors
            try:
                original_init(self, **kwargs)
            except OSError as e:
                if 'Read-only file system' in str(e):
                    logger.warning(f"Ignoring read-only filesystem error: {e}")
                else:
                    raise
        
        # Apply the patch
        config_module.Settings.__init__ = patched_init
        logger.info("Patched Settings.__init__ to handle read-only filesystem")
        
    except Exception as e:
        logger.error(f"Failed to patch Settings class: {e}")
        logger.error(traceback.format_exc())

try:
    # Must import settings first to ensure environment variables are loaded
    logger.info("Importing settings...")
    from app.core.config import settings
    
    logger.info(f"Cloud database enabled: {settings.cloud_db.CLOUD_ENABLED}")
    logger.info(f"Database URL: {settings.DATABASE_URL.split('://')[0]}://****@{settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else '****'}")
    
    # Now import database and models
    try:
        logger.info("Importing database and models...")
        from app.db.database import engine, Base
        from app.models.user import User
        from app.models.project import Project, ProjectUser
        from app.models.map import Map
        from app.models.event import Event
        from app.models.notification import Notification
        from app.models.user_activity import UserActivity
        
        # Try to import optional models
        try:
            from app.models.metric import Metric
            logger.info("Metric model imported successfully")
        except ImportError:
            logger.warning("Metric model not found, continuing without it")
        
        try:
            from app.models.user_preference import UserPreference
            logger.info("UserPreference model imported successfully")
        except ImportError:
            logger.warning("UserPreference model not found, continuing without it")
            
    except ImportError as e:
        logger.error(f"Error importing database or models: {e}")
        logger.error(traceback.format_exc())
        logger.error("Make sure the SQLAlchemy models are properly defined")
        sys.exit(1)
        
except ImportError as e:
    logger.error(f"Error importing application modules: {e}")
    logger.error(traceback.format_exc())
    logger.error("Make sure you're running this script from the backend directory")
    sys.exit(1)


def check_tables():
    """Check which tables already exist in the database"""
    try:
        logger.info("Attempting to connect to database...")
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        logger.info(f"Successfully connected to database. Existing tables: {existing_tables}")
        return existing_tables
    except SQLAlchemyError as e:
        logger.error(f"Error connecting to database: {e}")
        logger.error(traceback.format_exc())
        logger.info("Connection string format: postgresql://USERNAME@localhost/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE")
        
        # Try a direct query to see if we can connect at all
        try:
            logger.info("Attempting direct connection test...")
            conn = engine.connect()
            result = conn.execute(text("SELECT 1")).scalar()
            logger.info(f"Direct connection test result: {result}")
            conn.close()
        except Exception as ex:
            logger.error(f"Direct connection test failed: {ex}")
            logger.error(traceback.format_exc())
            
            # Try an even more direct connection using pg8000
            try:
                import pg8000
                logger.info("Attempting direct pg8000 connection...")
                
                sql_instance = os.getenv("CLOUD_DB_INSTANCE", "")
                db_name = os.getenv("CLOUD_DB_NAME", "construction_map")
                
                conn = pg8000.connect(
                    user="postgres",
                    database=db_name,
                    unix_sock=f"/cloudsql/{sql_instance}"
                )
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                logger.info(f"pg8000 direct connection test result: {result}")
                cursor.close()
                conn.close()
            except Exception as pg_ex:
                logger.error(f"pg8000 direct connection test failed: {pg_ex}")
                logger.error(traceback.format_exc())
        
        raise


def create_schema():
    """Create all tables that don't exist"""
    try:
        logger.info("Checking existing tables...")
        existing_tables = check_tables()
        
        # Print all model tables that will be created
        model_tables = [table.name for table in Base.metadata.tables.values()]
        logger.info(f"Tables defined in models: {model_tables}")
        
        # Create all tables
        logger.info("Creating database schema...")
        Base.metadata.create_all(engine)
        
        # Check tables again to see what was created
        new_tables = [t for t in inspect(engine).get_table_names() if t not in existing_tables]
        if new_tables:
            logger.info(f"Created new tables: {new_tables}")
        else:
            logger.info("No new tables were created - schema is up to date")
        
        # Final check of all tables
        final_tables = inspect(engine).get_table_names()
        logger.info(f"Final list of all tables: {final_tables}")
        
        logger.info("Database schema creation complete")
        return True
    except Exception as e:
        logger.error(f"Error creating schema: {e}")
        logger.error(traceback.format_exc())
        return False


if __name__ == "__main__":
    try:
        logger.info("Starting database schema creation...")
        success = create_schema()
        if success:
            logger.info("Schema creation completed successfully")
            sys.exit(0)
        else:
            logger.error("Schema creation failed")
            sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1) 