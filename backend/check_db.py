#!/usr/bin/env python3
import os
import sys
import psycopg2
from psycopg2 import sql

def main():
    print("Checking PostgreSQL connection settings...")
    
    # Get database connection information from .env.gcp
    instance_name = os.getenv('CLOUD_DB_INSTANCE', 'deep-responder-444017-h2:us-central1:construction-map-db')
    db_name = os.getenv('CLOUD_DB_NAME', 'construction_map')
    
    print(f"Instance name: {instance_name}")
    print(f"Database name: {db_name}")
    
    # Try the Cloud SQL connection
    try:
        connection_string = f"host=127.0.0.1 dbname={db_name} user=postgres password=postgres sslmode=disable"
        print(f"Attempting direct connection with: {connection_string}")
        
        conn = psycopg2.connect(connection_string)
        cursor = conn.cursor()
        
        # Check server version
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"Database version: {version[0]}")
        
        # Check if tables exist
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
        tables = cursor.fetchall()
        
        if tables:
            print("Tables found in database:")
            for table in tables:
                print(f"  {table[0]}")
                # Check row count for users table
                if table[0] == 'users':
                    cursor.execute("SELECT COUNT(*) FROM users;")
                    count = cursor.fetchone()[0]
                    print(f"    - Users count: {count}")
        else:
            print("No tables found in database!")
            print("Creating basic tables...")
            
            # Create the users table with the password_hash column
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            
            # Create an admin user
            cursor.execute("""
            INSERT INTO users (username, email, password_hash, is_admin, is_active)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (username) DO NOTHING;
            """, (
                "admin", 
                "seritec.ingenieria.rd@gmail.com",
                "$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By",
                True,
                True
            ))
            
            # Commit changes
            conn.commit()
            print("Basic tables created successfully!")
        
        cursor.close()
        conn.close()
        print("Database connection test successful")
        
    except Exception as e:
        print(f"Error connecting to database: {e}")
        print("Try direct Cloud SQL access with gcloud")
        print("Command: gcloud sql connect construction-map-db --user=postgres")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 