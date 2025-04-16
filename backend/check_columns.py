#!/usr/bin/env python3
import os
import sys
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

def main():
    # Load environment variables from .env or .env.gcp
    env_file = os.getenv('ENV_FILE', '.env')
    if os.path.exists(env_file):
        load_dotenv(env_file)
    elif os.path.exists('.env.gcp'):
        load_dotenv('.env.gcp')
    
    print("Checking users table schema...")
    
    # Get database connection information
    instance_name = os.getenv('CLOUD_DB_INSTANCE', 'deep-responder-444017-h2:us-central1:construction-map-db')
    db_name = os.getenv('CLOUD_DB_NAME', 'construction_map')
    
    print(f"Instance name: {instance_name}")
    print(f"Database name: {db_name}")
    
    try:
        connection_string = f"host=127.0.0.1 dbname={db_name} user=postgres password=postgres sslmode=disable"
        print(f"Attempting connection with: {connection_string}")
        
        conn = psycopg2.connect(connection_string)
        cursor = conn.cursor()
        
        # Check column names in users table
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        
        if columns:
            print("\nUsers table schema:")
            print("------------------")
            for column in columns:
                print(f"  {column[0]}: {column[1]}" + 
                     (f" (max length: {column[2]})" if column[2] is not None else ""))
                
            # Check if both hashed_password and password_hash columns exist
            has_hashed_password = any(col[0] == 'hashed_password' for col in columns)
            has_password_hash = any(col[0] == 'password_hash' for col in columns)
            
            if has_hashed_password and not has_password_hash:
                print("\nColumn issue detected: 'hashed_password' exists but 'password_hash' is missing.")
                print("Adding the 'password_hash' column and copying data...")
                
                try:
                    # Add password_hash column
                    cursor.execute("""
                        ALTER TABLE users 
                        ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
                    """)
                    
                    # Copy data from hashed_password to password_hash
                    cursor.execute("""
                        UPDATE users 
                        SET password_hash = hashed_password 
                        WHERE password_hash IS NULL AND hashed_password IS NOT NULL;
                    """)
                    
                    # Make password_hash NOT NULL
                    cursor.execute("""
                        ALTER TABLE users 
                        ALTER COLUMN password_hash SET NOT NULL;
                    """)
                    
                    conn.commit()
                    print("Fixed: Added 'password_hash' column and copied data from 'hashed_password'")
                except Exception as e:
                    conn.rollback()
                    print(f"Error fixing column: {e}")
            elif has_password_hash and not has_hashed_password:
                print("\nSchema is correct: Only 'password_hash' column exists.")
            elif has_password_hash and has_hashed_password:
                print("\nBoth 'hashed_password' and 'password_hash' columns exist.")
                print("This is fine for compatibility, but consider migrating fully to 'password_hash'.")
            else:
                print("\nNeither 'hashed_password' nor 'password_hash' columns exist!")
                print("This is a critical issue that needs to be fixed.")
        
        # Sample user data (with sensitive info masked)
        print("\nSample user data (masked):")
        print("-------------------------")
        cursor.execute("""
            SELECT id, username, email, is_admin, is_active,
                   CASE WHEN password_hash IS NOT NULL THEN 'Yes' ELSE 'No' END as has_password_hash,
                   CASE WHEN hashed_password IS NOT NULL THEN 'Yes' ELSE 'No' END as has_hashed_password
            FROM users
            LIMIT 5;
        """)
        
        users = cursor.fetchall()
        if users:
            for user in users:
                if len(user) >= 7:
                    print(f"  ID: {user[0]}, Username: {user[1]}, Email: {user[2]}, Admin: {user[3]}, Active: {user[4]}")
                    print(f"  Has password_hash: {user[5]}, Has hashed_password: {user[6]}")
                else:
                    print(f"  ID: {user[0]}, Username: {user[1]}, Email: {user[2]}, Admin: {user[3]}, Active: {user[4]}")
                    print("  Password column info not available")
                print("  ---")
        else:
            print("  No users found!")
        
        cursor.close()
        conn.close()
        print("\nDatabase schema check completed successfully.")
        
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 