#!/usr/bin/env python3
import os
import sys
import logging
import psycopg2
import traceback

# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("psycopg-direct")

def try_socket_connection():
    """Try to connect using Unix socket"""
    instance = os.getenv("CLOUD_DB_INSTANCE")
    db_name = os.getenv("CLOUD_DB_NAME", "construction_map")
    db_password = os.getenv("DB_PASSWORD", "")
    socket_path = f"/cloudsql/{instance}"
    
    logger.info(f"Trying socket connection to {socket_path}")
    logger.info(f"Database: {db_name}")
    
    try:
        # Connect with postgres user (default admin)
        conn = psycopg2.connect(
            host=socket_path,
            database=db_name,
            user="postgres",
            password=db_password
        )
        logger.info("✅ Postgres user socket connection successful")
        
        # Test the connection
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            logger.info(f"Query result: {result}")
            
            # Check if users table exists
            cursor.execute(
                "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users')"
            )
            has_users = cursor.fetchone()[0]
            logger.info(f"Users table exists: {has_users}")
            
            if has_users:
                # Check password_hash column
                cursor.execute(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='users'"
                )
                columns = [row[0] for row in cursor.fetchall()]
                logger.info(f"Columns in users table: {columns}")
                
                if 'password_hash' not in columns:
                    logger.info("Adding password_hash column to users table")
                    cursor.execute(
                        "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By'"
                    )
                    conn.commit()
                    logger.info("Added password_hash column successfully")
        
        conn.close()
        return True
    except Exception as e:
        logger.error(f"❌ Socket connection failed: {e}")
        logger.error(traceback.format_exc())
        return False

def try_tcp_connection():
    """Try to connect using TCP to localhost (Cloud SQL Proxy)"""
    db_name = os.getenv("CLOUD_DB_NAME", "construction_map")
    db_password = os.getenv("DB_PASSWORD", "")
    
    logger.info("Trying TCP connection to localhost")
    logger.info(f"Database: {db_name}")
    
    try:
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            database=db_name,
            user="postgres",
            password=db_password
        )
        logger.info("✅ TCP connection successful")
        conn.close()
        return True
    except Exception as e:
        logger.error(f"❌ TCP connection failed: {e}")
        return False

def try_private_ip_connection():
    """Try to connect using private IP"""
    private_ip = os.getenv("CLOUD_DB_PRIVATE_IP")
    if not private_ip:
        logger.error("❌ CLOUD_DB_PRIVATE_IP environment variable not set")
        return False
    
    db_name = os.getenv("CLOUD_DB_NAME", "construction_map")
    db_password = os.getenv("DB_PASSWORD", "")
    
    logger.info(f"Trying private IP connection to {private_ip}")
    logger.info(f"Database: {db_name}")
    
    try:
        conn = psycopg2.connect(
            host=private_ip,
            port=5432,
            database=db_name,
            user="postgres",
            password=db_password
        )
        logger.info("✅ Private IP connection successful")
        conn.close()
        return True
    except Exception as e:
        logger.error(f"❌ Private IP connection failed: {e}")
        return False
        
def main():
    """Try all available connection methods"""
    logger.info("Starting direct psycopg2 connection tests")
    
    # Load additional environment variables
    if 'CLOUD_DB_INSTANCE' not in os.environ and os.path.exists(".env.gcp"):
        logger.info("Loading environment variables from .env.gcp")
        with open(".env.gcp") as f:
            for line in f:
                if line.strip() and not line.startswith("#"):
                    key, value = line.strip().split("=", 1)
                    os.environ[key] = value
    
    # Try all connection methods
    socket_ok = try_socket_connection()
    tcp_ok = try_tcp_connection()
    private_ip_ok = try_private_ip_connection()
    
    # Show results
    logger.info(f"Socket connection: {'✅ SUCCESS' if socket_ok else '❌ FAILED'}")
    logger.info(f"TCP connection: {'✅ SUCCESS' if tcp_ok else '❌ FAILED'}")
    logger.info(f"Private IP connection: {'✅ SUCCESS' if private_ip_ok else '❌ FAILED'}")
    
    if socket_ok or tcp_ok or private_ip_ok:
        logger.info("✅ CONNECTION TEST PASSED - At least one method worked")
        return 0
    else:
        logger.error("❌ ALL CONNECTION METHODS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 