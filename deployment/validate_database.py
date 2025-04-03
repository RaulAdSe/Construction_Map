#!/usr/bin/env python3
"""
Database Validation Script
--------------------------
Tests connectivity to a PostgreSQL database and validates schema structure.
This script helps verify that the database is correctly set up for the application.
"""

import os
import sys
import argparse
import time
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Expected tables in the database
EXPECTED_TABLES = [
    "users", "maps", "map_tags", "projects", "project_members", 
    "events", "event_comments", "user_activity_logs"
]

# Required columns for user table
REQUIRED_USER_COLUMNS = [
    "id", "email", "hashed_password", "is_active", "is_admin", 
    "full_name", "created_at"
]

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Validate database connectivity and schema.")
    parser.add_argument("--host", default=os.getenv("POSTGRES_SERVER", "localhost"),
                      help="Database host (default: localhost or POSTGRES_SERVER env var)")
    parser.add_argument("--port", default=os.getenv("POSTGRES_PORT", "5432"),
                      help="Database port (default: 5432 or POSTGRES_PORT env var)")
    parser.add_argument("--user", default=os.getenv("POSTGRES_USER", "postgres"),
                      help="Database user (default: postgres or POSTGRES_USER env var)")
    parser.add_argument("--password", default=os.getenv("POSTGRES_PASSWORD", "postgres"),
                      help="Database password (default: postgres or POSTGRES_PASSWORD env var)")
    parser.add_argument("--database", default=os.getenv("POSTGRES_DB", "construction_map"),
                      help="Database name (default: construction_map or POSTGRES_DB env var)")
    parser.add_argument("--ssl", action="store_true", default=False,
                      help="Use SSL for database connection")
    return parser.parse_args()

def create_db_engine(args):
    """Create SQLAlchemy database engine."""
    connect_args = {}
    
    if args.ssl:
        connect_args["sslmode"] = "require"
    
    connection_string = f"postgresql://{args.user}:{args.password}@{args.host}:{args.port}/{args.database}"
    
    logger.info(f"Connecting to: {args.host}:{args.port}/{args.database} (user: {args.user})")
    return create_engine(connection_string, connect_args=connect_args)

def test_connection(engine, max_retries=5, retry_delay=2):
    """Test database connection with retries."""
    retry_count = 0
    last_error = None
    
    while retry_count < max_retries:
        try:
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1")).scalar()
                logger.info(f"Database connection successful (result: {result})")
                return True
        except SQLAlchemyError as e:
            last_error = str(e)
            logger.warning(f"Connection attempt {retry_count + 1} failed: {last_error}")
            retry_count += 1
            time.sleep(retry_delay)
    
    logger.error(f"Failed to connect to database after {max_retries} attempts. Last error: {last_error}")
    return False

def check_tables(engine):
    """Check if all expected tables exist in the database."""
    try:
        with engine.connect() as conn:
            # Get all tables in the database
            result = conn.execute(text(
                """
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                """
            ))
            existing_tables = [row[0] for row in result]
            
            logger.info(f"Found {len(existing_tables)} tables in database")
            
            # Check if all expected tables exist
            missing_tables = [table for table in EXPECTED_TABLES if table not in existing_tables]
            
            if missing_tables:
                logger.error(f"Missing tables: {', '.join(missing_tables)}")
                return False
            
            logger.info("All expected tables found")
            return True
    except SQLAlchemyError as e:
        logger.error(f"Error checking tables: {str(e)}")
        return False

def check_table_structure(engine, table_name, required_columns):
    """Check if a table has all required columns."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text(
                f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = '{table_name}'
                """
            ))
            existing_columns = [row[0] for row in result]
            
            missing_columns = [col for col in required_columns if col not in existing_columns]
            
            if missing_columns:
                logger.error(f"Table '{table_name}' is missing required columns: {', '.join(missing_columns)}")
                return False
            
            logger.info(f"Table '{table_name}' has all required columns")
            return True
    except SQLAlchemyError as e:
        logger.error(f"Error checking table structure: {str(e)}")
        return False

def run_validation():
    """Run the full database validation."""
    args = parse_args()
    engine = create_db_engine(args)
    
    # Validate connection
    if not test_connection(engine):
        return False
    
    # Validate tables
    if not check_tables(engine):
        return False
    
    # Validate specific table structures
    if not check_table_structure(engine, "users", REQUIRED_USER_COLUMNS):
        return False
    
    # Additional tests can be added here...
    
    return True

if __name__ == "__main__":
    logger.info("Starting database validation")
    
    if run_validation():
        logger.info("✅ Database validation successful!")
        sys.exit(0)
    else:
        logger.error("❌ Database validation failed")
        sys.exit(1) 