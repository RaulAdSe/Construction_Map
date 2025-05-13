#!/usr/bin/env python3
import os
import sys
import logging
import pg8000
import subprocess

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("test-connection")

def check_socket_directory():
    """Check the socket directory structure"""
    socket_dir = "/cloudsql"
    logger.info(f"Checking if socket directory exists: {socket_dir}")
    
    # Check if running locally or in Cloud Run
    in_cloud_run = os.path.exists(socket_dir)
    logger.info(f"Running in Cloud Run: {in_cloud_run}")
    
    if not in_cloud_run:
        logger.warning("Not running in Cloud Run, socket tests will fail")
        return False
    
    # Check contents of socket directory
    try:
        contents = os.listdir(socket_dir)
        logger.info(f"Socket directory contents: {contents}")
        
        # Check for specific instance
        instance = os.getenv("CLOUD_DB_INSTANCE")
        if instance:
            instance_path = f"{socket_dir}/{instance}"
            if os.path.exists(instance_path):
                logger.info(f"Instance socket path exists: {instance_path}")
                socket_contents = os.listdir(instance_path)
                logger.info(f"Instance socket contents: {socket_contents}")
                return True
            else:
                logger.error(f"Instance socket path doesn't exist: {instance_path}")
                return False
    except Exception as e:
        logger.error(f"Error checking socket directory: {e}")
        return False

def try_psql_command():
    """Try to connect with psql command"""
    logger.info("Attempting to connect with psql command")
    
    db_name = os.getenv("CLOUD_DB_NAME", "construction_map")
    instance = os.getenv("CLOUD_DB_INSTANCE")
    socket_path = f"/cloudsql/{instance}"
    
    # Try with service account
    service_account = os.getenv("CLOUD_DB_USER", os.getenv("CLOUD_DB_IAM_USER"))
    if service_account:
        cmd = f"PGPASSWORD='' psql -h {socket_path} -U {service_account} -d {db_name} -c '\\conninfo'"
        logger.info(f"Running: {cmd}")
        try:
            output = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT)
            logger.info(f"Connection successful with service account: {output.decode('utf-8')}")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Error connecting with service account: {e.output.decode('utf-8')}")
    
    # Try with postgres user
    db_password = os.getenv("DB_PASSWORD", "")
    cmd = f"PGPASSWORD='{db_password}' psql -h {socket_path} -U postgres -d {db_name} -c '\\conninfo'"
    logger.info(f"Running: PGPASSWORD='***' psql -h {socket_path} -U postgres -d {db_name} -c '\\conninfo'")
    try:
        output = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT)
        logger.info(f"Connection successful with postgres user: {output.decode('utf-8')}")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Error connecting with postgres user: {e.output.decode('utf-8')}")
        return False

def try_pg8000_connection():
    """Try to connect with pg8000"""
    logger.info("Attempting to connect with pg8000")
    
    db_name = os.getenv("CLOUD_DB_NAME", "construction_map")
    instance = os.getenv("CLOUD_DB_INSTANCE")
    socket_path = f"/cloudsql/{instance}"
    
    # Try with postgres user and password 
    db_password = os.getenv("DB_PASSWORD")
    if db_password:
        logger.info("Trying postgres user with password")
        try:
            conn = pg8000.connect(
                user="postgres",
                password=db_password,
                database=db_name,
                unix_sock=socket_path
            )
            logger.info("Connection successful with postgres user")
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error connecting with postgres user: {e}")
    
    # Try with IAM user
    service_account = os.getenv("CLOUD_DB_USER", os.getenv("CLOUD_DB_IAM_USER"))
    if service_account:
        logger.info(f"Trying IAM user: {service_account}")
        try:
            conn = pg8000.connect(
                user=service_account,
                database=db_name,
                unix_sock=socket_path
            )
            logger.info("Connection successful with IAM user")
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error connecting with IAM user: {e}")
    
    return False

def load_env_from_file():
    """Load environment variables from .env.gcp"""
    try:
        if os.path.exists(".env.gcp"):
            logger.info("Loading environment from .env.gcp")
            with open(".env.gcp") as f:
                for line in f:
                    if line.strip() and not line.startswith("#"):
                        key, value = line.strip().split("=", 1)
                        os.environ[key] = value
                        if "PASSWORD" not in key:
                            logger.info(f"Loaded: {key}={value}")
                        else:
                            logger.info(f"Loaded: {key}=****")
    except Exception as e:
        logger.error(f"Error loading environment: {e}")

def main():
    """Main function"""
    logger.info("Starting database connection test")
    
    # Load environment variables
    load_env_from_file()
    
    # Print important environment variables
    for var in ["CLOUD_DB_INSTANCE", "CLOUD_DB_NAME", "CLOUD_DB_USER", "CLOUD_DB_IAM_USER"]:
        logger.info(f"{var}: {os.getenv(var, 'Not set')}")
    
    # Test socket directory
    socket_ok = check_socket_directory()
    logger.info(f"Socket directory check: {'OK' if socket_ok else 'FAILED'}")
    
    # Test psql command
    psql_ok = try_psql_command()
    logger.info(f"PSQL command test: {'OK' if psql_ok else 'FAILED'}")
    
    # Test pg8000 connection
    pg8000_ok = try_pg8000_connection()
    logger.info(f"pg8000 connection test: {'OK' if pg8000_ok else 'FAILED'}")
    
    # Overall result
    if socket_ok and (psql_ok or pg8000_ok):
        logger.info("CONNECTION TEST PASSED")
        return 0
    else:
        logger.error("CONNECTION TEST FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 