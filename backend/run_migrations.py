#!/usr/bin/env python
"""
Schema migration script to be run by postgres user
"""
import os
import sys
import logging
from sqlalchemy import create_engine, text

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    # Get database connection from environment
    db_host = os.environ.get("CLOUD_SQL_IP", "localhost")
    db_name = os.environ.get("CLOUD_DB_NAME", "construction_map")
    db_user = "postgres"  # Use postgres superuser for schema changes
    db_password = os.environ.get("POSTGRES_PASSWORD")
    
    if not db_password:
        logger.error("POSTGRES_PASSWORD environment variable not set")
        sys.exit(1)
    
    # Create SQLAlchemy engine
    engine = create_engine(f"postgresql://{db_user}:{db_password}@{db_host}/{db_name}")
    
    try:
        with engine.connect() as connection:
            # Check if password_hash column exists
            result = connection.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users' 
                    AND column_name = 'password_hash'
                )
            """))
            has_password_hash = result.scalar()
            
            if not has_password_hash:
                logger.info("Adding password_hash column to users table")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN password_hash VARCHAR(255) NOT NULL 
                    DEFAULT '$2b$12$JEQtChVtfJTBb6Z9ZIQ09eKDxcQiKTYQ1x6ZnlR3GZD.aZMg7YHqm'
                """))
                connection.commit()
                logger.info("Successfully added password_hash column")
            else:
                logger.info("password_hash column already exists")
                
            # Run any other schema migrations here
            
            # Grant permissions to service account
            connection.execute(text("""
                GRANT ALL PRIVILEGES ON TABLE users TO "servitec-map-service@deep-responder-444017-h2.iam";
            """))
            connection.commit()
            logger.info("Granted all privileges to service account")
            
    except Exception as e:
        logger.error(f"Error executing migrations: {e}")
        sys.exit(1)
    
    logger.info("Migrations completed successfully")

if __name__ == "__main__":
    main() 