#!/usr/bin/env python3
"""
Cloud Database Setup Utility Script

This script helps administrators check and configure the application for cloud database deployment.
It provides:
1. Current configuration display
2. Database connection check
3. Environment variable generation for cloud settings
4. Basic database migration info
"""

import os
import sys
import json
import argparse
from sqlalchemy import create_engine, text
from datetime import datetime
import time

# Add the app directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from app.core.config import settings
    from app.db.database import Base
except ImportError as e:
    print(f"Error importing application modules: {e}")
    print("Make sure you're running this script from the backend directory")
    sys.exit(1)


def check_configuration():
    """Display the current configuration settings"""
    print("\n=== CURRENT CONFIGURATION ===")
    print(f"Database URI: {mask_password(settings.SQLALCHEMY_DATABASE_URI)}")
    print(f"Cloud Database Enabled: {settings.cloud_db.CLOUD_ENABLED}")
    
    if settings.cloud_db.CLOUD_ENABLED:
        print(f"Cloud Connection String: {mask_password(settings.cloud_db.CONNECTION_STRING)}")
        print(f"Pool Size: {settings.cloud_db.POOL_SIZE}")
        print(f"Max Overflow: {settings.cloud_db.MAX_OVERFLOW}")
        print(f"SSL Mode: {settings.cloud_db.SSL_MODE}")
        print(f"SSL CA Certificate: {'Configured' if settings.cloud_db.SSL_CA_CERT else 'Not Configured'}")
    
    print("\n=== MONITORING CONFIGURATION ===")
    print(f"Log Path: {settings.monitoring.LOG_PATH}")
    print(f"Slow Query Threshold: {settings.monitoring.SLOW_QUERY_THRESHOLD} seconds")
    print(f"User Activity Retention: {settings.monitoring.ACTIVITY_RETENTION_DAYS} days")
    print(f"Max Activities Per User: {settings.monitoring.MAX_ACTIVITIES_PER_USER}")


def mask_password(connection_string):
    """Mask the password in a connection string for display"""
    if not connection_string:
        return None
    
    # Simple approach for standard PostgreSQL connection strings
    if "://" in connection_string:
        parts = connection_string.split("://")
        if len(parts) == 2 and "@" in parts[1]:
            auth_part = parts[1].split("@")[0]
            if ":" in auth_part:
                user = auth_part.split(":")[0]
                masked = f"{parts[0]}://{user}:****@{parts[1].split('@')[1]}"
                return masked
    
    # If we can't parse it well, just return a fully masked version
    return "****" + connection_string[-10:] if len(connection_string) > 10 else "****"


def test_connection():
    """Test the database connection"""
    print("\n=== DATABASE CONNECTION TEST ===")
    
    # Determine which connection string to test
    if settings.cloud_db.CLOUD_ENABLED and settings.cloud_db.CONNECTION_STRING:
        print("Testing cloud database connection...")
        connection_string = settings.cloud_db.CONNECTION_STRING
        engine_args = {
            "pool_size": settings.cloud_db.POOL_SIZE,
            "max_overflow": settings.cloud_db.MAX_OVERFLOW,
            "pool_timeout": settings.cloud_db.POOL_TIMEOUT,
            "pool_recycle": settings.cloud_db.POOL_RECYCLE,
        }
        
        if settings.cloud_db.SSL_MODE:
            engine_args["connect_args"] = {"sslmode": settings.cloud_db.SSL_MODE}
            if settings.cloud_db.SSL_CA_CERT:
                engine_args["connect_args"]["sslrootcert"] = settings.cloud_db.SSL_CA_CERT
    else:
        print("Testing local database connection...")
        connection_string = settings.SQLALCHEMY_DATABASE_URI
        engine_args = {}
    
    try:
        # Create engine and test connection
        engine = create_engine(connection_string, **engine_args)
        start_time = time.time()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).fetchone()
            query_time = time.time() - start_time
        
        print(f"✅ Connection successful!")
        print(f"Query time: {query_time:.4f} seconds")
        
        # Get database info
        with engine.connect() as conn:
            version = conn.execute(text("SELECT version()")).fetchone()[0]
            print(f"Database version: {version}")
            
            # Try to get database size info
            try:
                db_name = connection_string.split("/")[-1]
                size_query = text(f"""
                    SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
                """)
                size_result = conn.execute(size_query).fetchone()
                print(f"Database size: {size_result[0]}")
            except Exception as e:
                # This might fail due to permissions, so don't fail the whole check
                print(f"Could not determine database size: {e}")
                
        return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False


def generate_env_vars(args):
    """Generate environment variables for cloud database setup"""
    print("\n=== CLOUD DATABASE ENVIRONMENT VARIABLES ===")
    
    env_vars = {
        "CLOUD_DB_ENABLED": "true",
        "CLOUD_DB_CONNECTION_STRING": args.connection_string or "postgresql://user:password@hostname:5432/dbname",
        "CLOUD_DB_POOL_SIZE": args.pool_size or "10",
        "CLOUD_DB_MAX_OVERFLOW": args.max_overflow or "20",
        "CLOUD_DB_POOL_TIMEOUT": "30",
        "CLOUD_DB_POOL_RECYCLE": "1800",
        "CLOUD_DB_SSL_MODE": args.ssl_mode or "require"
    }
    
    if args.ssl_ca_cert:
        env_vars["CLOUD_DB_SSL_CA_CERT"] = args.ssl_ca_cert
    
    # Standard monitoring settings
    env_vars.update({
        "ACTIVITY_RETENTION_DAYS": "90",
        "MAX_ACTIVITIES_PER_USER": "1000",
        "SLOW_QUERY_THRESHOLD": "0.5",
        "LOG_PATH": "./logs",
    })
    
    print("\n# Add these environment variables to your cloud deployment:")
    for key, value in env_vars.items():
        print(f"{key}={value}")
    
    if args.output:
        with open(args.output, "w") as f:
            for key, value in env_vars.items():
                f.write(f"{key}={value}\n")
        print(f"\nEnvironment variables written to {args.output}")


def list_tables():
    """List existing tables and their row counts"""
    print("\n=== DATABASE TABLES ===")
    
    # Determine which connection to use
    if settings.cloud_db.CLOUD_ENABLED and settings.cloud_db.CONNECTION_STRING:
        connection_string = settings.cloud_db.CONNECTION_STRING
        engine_args = settings.ENGINE_ARGS
    else:
        connection_string = settings.SQLALCHEMY_DATABASE_URI
        engine_args = {}
    
    try:
        engine = create_engine(connection_string, **engine_args)
        
        # Get list of tables
        with engine.connect() as conn:
            # Get tables
            tables_query = text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            tables = [row[0] for row in conn.execute(tables_query).fetchall()]
            
            if not tables:
                print("No tables found in the database.")
                return
            
            print(f"Found {len(tables)} tables:")
            
            # Get row counts for each table
            for table in tables:
                try:
                    count_query = text(f"SELECT COUNT(*) FROM \"{table}\"")
                    count = conn.execute(count_query).fetchone()[0]
                    print(f"  - {table}: {count} rows")
                except Exception as e:
                    print(f"  - {table}: Error counting rows: {e}")
    
    except Exception as e:
        print(f"Error listing tables: {e}")


def generate_gcp_env_vars(args):
    """Generate environment variables specifically for GCP Cloud SQL setup"""
    print("\n=== GCP CLOUD SQL ENVIRONMENT VARIABLES ===")
    
    instance_name = args.instance_name or "your-instance-name"
    db_name = args.db_name or "construction_map"
    db_user = args.db_user or "postgres"
    project_id = args.project_id or "your-project-id"
    region = args.region or "us-central1"
    
    # Build the connection string based on connection method
    if args.use_proxy:
        # Cloud SQL Auth proxy - good for local development
        conn_string = f"postgresql://{db_user}:{args.db_password or 'password'}@127.0.0.1:5432/{db_name}"
        print("\n# Using Cloud SQL Auth Proxy connection")
        print("# Install the proxy: https://cloud.google.com/sql/docs/postgres/connect-auth-proxy")
        print(f"# Run: ./cloud-sql-proxy {project_id}:{region}:{instance_name}")
    else:
        # Direct connection with socket - good for GCP services (Cloud Run, App Engine, etc.)
        socket_path = f"/cloudsql/{project_id}:{region}:{instance_name}"
        conn_string = f"postgresql://{db_user}:{args.db_password or 'password'}@/{db_name}?host={socket_path}"
        print("\n# Using direct socket connection (for GCP services)")
    
    env_vars = {
        "CLOUD_DB_ENABLED": "true",
        "CLOUD_DB_CONNECTION_STRING": conn_string,
        "CLOUD_DB_POOL_SIZE": args.pool_size or "10",      # Good default for Cloud SQL
        "CLOUD_DB_MAX_OVERFLOW": args.max_overflow or "20", # Good default for Cloud SQL
        "CLOUD_DB_POOL_TIMEOUT": "30",
        "CLOUD_DB_POOL_RECYCLE": "1800",    # 30 minutes - Cloud SQL drops idle connections around 10 hours
        "CLOUD_DB_SSL_MODE": "require"      # GCP Cloud SQL connections should always use SSL
    }
    
    # Standard monitoring settings
    env_vars.update({
        "ACTIVITY_RETENTION_DAYS": "90",
        "MAX_ACTIVITIES_PER_USER": "1000",
        "SLOW_QUERY_THRESHOLD": "0.5",
        "LOG_PATH": "/logs",   # Set to a volume mount path in cloud environment
    })
    
    print("\n# Add these environment variables to your GCP deployment:")
    for key, value in env_vars.items():
        print(f"{key}={value}")
    
    if args.output:
        with open(args.output, "w") as f:
            for key, value in env_vars.items():
                f.write(f"{key}={value}\n")
        print(f"\nEnvironment variables written to {args.output}")
    
    if not args.use_proxy:
        print("\nIMPORTANT: For direct socket connections:")
        print("- Ensure your service has the Cloud SQL Client IAM role")
        print("- In Cloud Run or App Engine, add the Cloud SQL connection as a resource")


def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Cloud Database Setup Utility")
    parser.add_argument("--check", action="store_true", help="Check current configuration")
    parser.add_argument("--test", action="store_true", help="Test database connection")
    parser.add_argument("--tables", action="store_true", help="List database tables and row counts")
    parser.add_argument("--generate-env", action="store_true", help="Generate environment variables")
    parser.add_argument("--generate-gcp-env", action="store_true", help="Generate GCP Cloud SQL environment variables")
    parser.add_argument("--connection-string", help="Cloud DB connection string")
    parser.add_argument("--pool-size", help="Connection pool size")
    parser.add_argument("--max-overflow", help="Connection pool max overflow")
    parser.add_argument("--ssl-mode", choices=["disable", "allow", "prefer", "require", "verify-ca", "verify-full"], 
                        help="SSL mode for cloud connection")
    parser.add_argument("--ssl-ca-cert", help="Path to SSL CA certificate")
    parser.add_argument("--output", help="Output file for environment variables")
    
    # GCP specific parameters
    parser.add_argument("--project-id", help="GCP project ID")
    parser.add_argument("--instance-name", help="GCP Cloud SQL instance name")
    parser.add_argument("--region", help="GCP region (default: us-central1)")
    parser.add_argument("--db-name", help="Database name in Cloud SQL")
    parser.add_argument("--db-user", help="Database username in Cloud SQL")
    parser.add_argument("--db-password", help="Database password in Cloud SQL")
    parser.add_argument("--use-proxy", action="store_true", help="Use Cloud SQL Auth Proxy instead of direct socket")
    
    args = parser.parse_args()
    
    # If no arguments, show help
    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(0)
    
    # Run selected actions
    if args.check or args.test or args.tables:
        if args.check:
            check_configuration()
        
        if args.test:
            test_connection()
            
        if args.tables:
            list_tables()
    
    if args.generate_env:
        generate_env_vars(args)
    
    if args.generate_gcp_env:
        generate_gcp_env_vars(args)


if __name__ == "__main__":
    print(f"Cloud Database Setup Utility - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    main() 