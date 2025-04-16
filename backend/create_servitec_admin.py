#!/usr/bin/env python3
"""
Create a Servitec admin user - works in both local and Cloud environments
"""

import os
import sys
import logging
import traceback
from sqlalchemy import text, inspect
from sqlalchemy.exc import SQLAlchemyError

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the current directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

try:
    # Import application modules
    from app.db.database import SessionLocal, engine
    from app.models.user import User
    from sqlalchemy.orm import Session
except ImportError as e:
    logger.error(f"Error importing application modules: {e}")
    logger.error(traceback.format_exc())
    logger.error("Make sure you're running this script from the backend directory")
    sys.exit(1)

def verify_database_state():
    """Verify that the database is properly configured and tables exist"""
    try:
        # Check if tables exist, particularly users table
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        logger.info(f"Database tables found: {existing_tables}")
        
        if 'users' not in existing_tables:
            logger.error("CRITICAL ERROR: 'users' table does not exist in the database!")
            logger.error("The create_cloud_schema.py script probably failed.")
            logger.error("Please check database connection and try running create_cloud_schema.py manually.")
            return False
        
        return True
    except Exception as e:
        logger.error(f"Error checking database state: {e}")
        logger.error(traceback.format_exc())
        return False

def test_database_connection(db: Session):
    """Test that we can successfully query the database"""
    try:
        # Try a simple query
        result = db.execute(text("SELECT 1")).scalar()
        logger.info(f"Database connection test result: {result}")
        
        # Check users table if possible
        try:
            count = db.query(User).count()
            logger.info(f"Current user count in database: {count}")
        except SQLAlchemyError as e:
            logger.error(f"Cannot query users table: {e}")
            logger.error(traceback.format_exc())
            return False
            
        return True
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        logger.error(traceback.format_exc())
        return False

def create_servitec_admin(db: Session):
    """Create the servitec admin user if it doesn't exist"""
    
    # Check if we're running in Cloud environment
    is_cloud = os.getenv("CLOUD_DB_ENABLED", "false").lower() == "true"
    environment = "Cloud" if is_cloud else "Local"
    
    logger.info(f"Running in {environment} environment")
    
    # First verify database state
    if not verify_database_state():
        logger.error("Database schema verification failed - tables might be missing")
        return False
        
    # Test connection
    if not test_database_connection(db):
        logger.error("Database connection test failed - cannot create admin user")
        return False
    
    # Check if the admin user already exists
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        
        if admin:
            # Update the existing admin
            logger.info("Admin user already exists, updating details...")
            admin.email = "seritec.ingenieria.rd@gmail.com"
            admin.password_hash = "$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By"
            admin.is_admin = True
            admin.is_active = True
            db.commit()
            logger.info("Admin user updated successfully!")
        else:
            # Create a new admin user
            logger.info("Creating new admin user...")
            admin_user = User(
                username="admin",
                email="seritec.ingenieria.rd@gmail.com",
                password_hash="$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By",
                is_admin=True,
                is_active=True
            )
            
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            logger.info("Admin user created successfully!")
        
        # Verify the user exists and is correctly configured
        admin = db.query(User).filter(User.username == "admin").first()
        if admin:
            logger.info(f"Verified admin user exists: {admin.username} (ID: {admin.id})")
            logger.info(f"Email: {admin.email}")
            logger.info(f"Admin status: {admin.is_admin}")
            logger.info(f"Active status: {admin.is_active}")
            logger.info(f"Password hash exists: {bool(admin.password_hash)}")
        else:
            logger.error("Failed to verify admin user")
            
        return True
    except Exception as e:
        logger.error(f"Error creating/updating admin user: {e}")
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    try:
        logger.info("Connecting to database...")
        db = SessionLocal()
        success = create_servitec_admin(db)
        if success:
            logger.info("Admin user setup completed successfully")
            sys.exit(0)
        else:
            logger.error("Admin user setup failed")
            sys.exit(1)
    except Exception as e:
        logger.error(f"Error: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)
    finally:
        logger.info("Closing database connection")
        db.close() 