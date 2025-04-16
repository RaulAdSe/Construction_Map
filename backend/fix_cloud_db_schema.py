#!/usr/bin/env python3
import os
import sys
import traceback
import psycopg2
import logging
from google.cloud.sql.connector import Connector

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

# Cloud SQL instance connection name
INSTANCE_CONNECTION_NAME = os.getenv("CLOUD_DB_INSTANCE", "deep-responder-444017-h2:us-central1:construction-map-db")
DB_NAME = os.getenv("CLOUD_DB_NAME", "construction_map")
IAM_USER = os.getenv("CLOUD_DB_IAM_USER", "servitec-map-service@deep-responder-444017-h2.iam")
USE_IAM = os.getenv("CLOUD_DB_IAM_AUTHENTICATION", "true").lower() == "true"

def get_connection_iam():
    """Get database connection using IAM authentication"""
    logger.info(f"Connecting to Cloud SQL instance {INSTANCE_CONNECTION_NAME} with IAM user {IAM_USER}")
    connector = Connector()
    
    conn = connector.connect(
        INSTANCE_CONNECTION_NAME,
        "pg8000",
        user=IAM_USER,
        db=DB_NAME,
        enable_iam_auth=True,
    )
    
    return conn

def get_connection_socket():
    """Get database connection using Unix socket"""
    logger.info(f"Connecting to Cloud SQL instance {INSTANCE_CONNECTION_NAME} with Unix socket")
    
    # Get local socket on Cloud Run
    socket_dir = f"/cloudsql/{INSTANCE_CONNECTION_NAME}"
    
    # Connect with postgres user via socket (usually has more permissions)
    conn = psycopg2.connect(
        host=socket_dir,
        user="postgres",
        dbname=DB_NAME,
    )
    
    return conn

def fix_users_table_schema(conn):
    """Fix the users table schema by adding password_hash column if missing"""
    try:
        cursor = conn.cursor()
        
        # Check if password_hash column exists
        logger.info("Checking if password_hash column exists in users table...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'users' 
                AND column_name = 'password_hash'
            );
        """)
        column_exists = cursor.fetchone()[0]
        
        if column_exists:
            logger.info("password_hash column already exists. No changes needed.")
            return True
        
        # Check if hashed_password column exists
        logger.info("Checking if hashed_password column exists in users table...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'users' 
                AND column_name = 'hashed_password'
            );
        """)
        hashed_password_exists = cursor.fetchone()[0]
        
        if hashed_password_exists:
            logger.info("hashed_password column found. Adding password_hash column and copying values...")
            
            # Add the password_hash column
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN password_hash VARCHAR(255);
            """)
            
            # Copy data from hashed_password to password_hash
            cursor.execute("""
                UPDATE users 
                SET password_hash = hashed_password;
            """)
            
            # Make password_hash NOT NULL
            cursor.execute("""
                ALTER TABLE users 
                ALTER COLUMN password_hash SET NOT NULL;
            """)
            
            logger.info("Column password_hash added and data copied from hashed_password successfully.")
        else:
            logger.error("Neither password_hash nor hashed_password columns exist. Creating password_hash column...")
            
            # Add the password_hash column
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN password_hash VARCHAR(255) DEFAULT '$2b$12$JEQtChVtfJTBb6Z9ZIQ09eKDxcQiKTYQ1x6ZnlR3GZD.aZMg7YHqm' NOT NULL;
            """)
            
            logger.info("Column password_hash added with a default value successfully.")
        
        # Commit changes
        conn.commit()
        
        # Display updated schema
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'users'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        logger.info("Updated users table schema:")
        for column in columns:
            logger.info(f"  {column[0]}: {column[1]}")
        
        # Display sample data (without sensitive info)
        cursor.execute("""
            SELECT id, username, email, is_admin, is_active,
                   'yes' as has_password_hash
            FROM users
            LIMIT 5;
        """)
        
        users = cursor.fetchall()
        logger.info("Sample users (first 5):")
        if users:
            for user in users:
                logger.info(f"  ID: {user[0]}, Username: {user[1]}, Email: {user[2]}, Admin: {user[3]}, Active: {user[4]}")
        else:
            logger.info("  No users found.")
        
        return True
        
    except Exception as e:
        logger.error(f"Error fixing users table schema: {e}")
        logger.error(traceback.format_exc())
        conn.rollback()
        return False
    finally:
        if cursor:
            cursor.close()

def main():
    """Main function to fix the database schema"""
    conn = None
    success = False
    
    try:
        # Try IAM authentication first if enabled
        if USE_IAM:
            try:
                logger.info("Attempting connection with IAM authentication...")
                conn = get_connection_iam()
                success = fix_users_table_schema(conn)
            except Exception as e:
                logger.warning(f"IAM authentication failed: {e}")
                logger.warning("Falling back to socket connection...")
                if conn:
                    conn.close()
                conn = None
        
        # If IAM didn't work or is disabled, try socket
        if not conn:
            try:
                logger.info("Attempting connection with Unix socket...")
                conn = get_connection_socket()
                success = fix_users_table_schema(conn)
            except Exception as e:
                logger.error(f"Socket connection failed: {e}")
                logger.error(traceback.format_exc())
                return False
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        logger.error(traceback.format_exc())
        return False
    finally:
        if conn:
            conn.close()
    
    return success

if __name__ == "__main__":
    result = main()
    if result:
        logger.info("Database schema fixed successfully!")
        sys.exit(0)
    else:
        logger.error("Failed to fix database schema.")
        sys.exit(1) 