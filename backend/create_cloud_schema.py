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
from sqlalchemy import inspect, create_engine
from sqlalchemy.exc import SQLAlchemyError

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the app directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Load environment variables
if os.path.exists(".env.gcp"):
    logger.info("Loading environment from .env.gcp")
    from dotenv import load_dotenv
    load_dotenv(".env.gcp")
    
    # Display connection info for debugging (without credentials)
    conn_str = os.getenv("CLOUD_DB_CONNECTION_STRING", "")
    if "@" in conn_str and "?" in conn_str:
        # Mask/sanitize the connection string for logging
        user_part = conn_str.split("@")[0] + "@"
        host_part = conn_str.split("@")[1]
        logger.info(f"Using connection: {user_part}[...]/{host_part}")
    
    logger.info("IAM Authentication enabled: %s", os.getenv("CLOUD_DB_IAM_AUTHENTICATION", "False"))

try:
    # Must import settings first to ensure environment variables are loaded
    from app.core.config import settings
    
    # Now import database and models
    try:
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
        logger.error("Make sure the SQLAlchemy models are properly defined")
        sys.exit(1)
        
except ImportError as e:
    logger.error(f"Error importing application modules: {e}")
    logger.error("Make sure you're running this script from the backend directory")
    sys.exit(1)


def check_tables():
    """Check which tables already exist in the database"""
    try:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        logger.info(f"Existing tables: {existing_tables}")
        return existing_tables
    except SQLAlchemyError as e:
        logger.error(f"Error connecting to database: {e}")
        logger.info("Connection string format: postgresql://USERNAME@localhost/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE")
        raise


def create_schema():
    """Create all tables that don't exist"""
    try:
        logger.info("Checking existing tables...")
        existing_tables = check_tables()
        
        # Create all tables
        logger.info("Creating database schema...")
        Base.metadata.create_all(engine)
        
        # Check tables again to see what was created
        new_tables = [t for t in inspect(engine).get_table_names() if t not in existing_tables]
        if new_tables:
            logger.info(f"Created new tables: {new_tables}")
        else:
            logger.info("No new tables were created - schema is up to date")
        
        logger.info("Database schema creation complete")
        return True
    except Exception as e:
        logger.error(f"Error creating schema: {e}")
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
        sys.exit(1) 