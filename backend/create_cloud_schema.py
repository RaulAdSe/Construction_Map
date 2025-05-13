#!/usr/bin/env python3
"""
Create Cloud Database Schema Script

This script creates the database schema directly using the SQL dump file
without relying on SQLAlchemy models. This ensures the database structure
exactly matches what's in production, including any manual changes.

Usage:
    python create_cloud_schema.py

Environment variables:
    Make sure your Cloud SQL connection details are properly set in .env.cloud
"""

import os
import sys
import logging
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import SQLAlchemyError
import traceback
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

# Path to the SQL dump file
SQL_DUMP_FILE = os.path.join(os.path.dirname(__file__), "migrations", "source_Cloud_SQL_Export_2025-05-06 (17_17_40).sql")

try:
    # Import settings to ensure environment variables are loaded
    logger.info("Importing settings...")
    from app.core.config import settings
    
    logger.info(f"Cloud database enabled: {settings.cloud_db.CLOUD_ENABLED}")
    logger.info(f"Database URL: {settings.DATABASE_URL.split('://')[0]}://****@{settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else '****'}")
    
    # Set up the database engine using the URL from settings
    try:
        from app.db.database import engine
        logger.info("Successfully imported database engine")
    except ImportError as e:
        logger.error(f"Error importing database: {e}")
        logger.error(traceback.format_exc())
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


def execute_sql_dump():
    """Create schema using the SQL dump file"""
    try:
        logger.info("Checking existing tables...")
        existing_tables = check_tables()
        
        # Read SQL dump file
        if not os.path.exists(SQL_DUMP_FILE):
            logger.error(f"SQL dump file not found: {SQL_DUMP_FILE}")
            return False
        
        logger.info(f"Reading SQL dump file: {SQL_DUMP_FILE}")
        with open(SQL_DUMP_FILE, 'r') as f:
            sql_dump = f.read()
        
        # Split SQL dump into individual statements
        # PostgreSQL dumps typically use semicolons as statement separators
        statements = []
        current_statement = []
        
        # Process the SQL file line by line
        for line in sql_dump.splitlines():
            # Skip comment lines
            if line.strip().startswith('--'):
                continue
                
            # Add the line to the current statement
            current_statement.append(line)
            
            # If the line ends with a semicolon, it's the end of the statement
            if line.strip().endswith(';'):
                statements.append('\n'.join(current_statement))
                current_statement = []
        
        # If there's any leftover partial statement, add it (though this shouldn't happen in proper SQL dumps)
        if current_statement:
            statements.append('\n'.join(current_statement))
        
        logger.info(f"Extracted {len(statements)} SQL statements from dump file")
        
        # Execute statements that create database objects
        with engine.connect() as conn:
            # Start a transaction
            with conn.begin():
                # Extract and execute only the statements that create database objects (not data)
                # This includes CREATE TABLE, CREATE FUNCTION, CREATE INDEX, etc.
                schema_statements = [
                    stmt for stmt in statements 
                    if any(keyword in stmt.upper() for keyword in [
                        'CREATE TABLE', 'CREATE FUNCTION', 'CREATE SEQUENCE', 
                        'CREATE INDEX', 'CREATE TRIGGER', 'CREATE VIEW',
                        'ALTER TABLE', 'ALTER SEQUENCE', 'ALTER INDEX',
                        'SET default_tablespace', 'SET default_table_access_method'
                    ])
                ]
                
                logger.info(f"Executing {len(schema_statements)} schema creation statements")
                
                for i, stmt in enumerate(schema_statements):
                    try:
                        # Skip statements that might conflict with existing tables
                        skip = False
                        for table in existing_tables:
                            if f'CREATE TABLE public.{table}' in stmt:
                                logger.info(f"Skipping creation of existing table: {table}")
                                skip = True
                                break
                        
                        if skip:
                            continue
                            
                        conn.execute(text(stmt))
                        
                        # Log progress every 10 statements
                        if (i + 1) % 10 == 0 or i == 0 or i == len(schema_statements) - 1:
                            logger.info(f"Executed {i + 1}/{len(schema_statements)} statements")
                    
                    except Exception as e:
                        logger.warning(f"Error executing statement {i + 1}: {str(e)}")
                        logger.debug(f"Problematic SQL statement: {stmt[:100]}...")
        
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
        logger.info("Starting database schema creation using SQL dump file...")
        success = execute_sql_dump()
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