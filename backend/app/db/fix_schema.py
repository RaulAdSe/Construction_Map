import logging
import os
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

def ensure_password_hash_column(engine):
    """
    Ensure the password_hash column exists in the users table.
    This function is called during app startup to fix the schema if needed.
    """
    try:
        logger.info("Checking if password_hash column exists in users table...")
        
        # Check if column exists
        with engine.connect() as conn:
            # First, check if the users table exists
            conn.execute(text("COMMIT"))  # Ensure any previous transaction is committed
            
            table_check = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                )
            """))
            table_exists = table_check.scalar()
            
            if not table_exists:
                logger.info("users table does not exist. Creating it now...")
                
                # Create the users table if it doesn't exist
                conn.execute(text("""
                    CREATE TABLE users (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(255) UNIQUE NOT NULL,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        is_admin BOOLEAN NOT NULL DEFAULT false,
                        is_active BOOLEAN NOT NULL DEFAULT true,
                        password_hash VARCHAR(255) NOT NULL
                    )
                """))
                
                conn.execute(text("COMMIT"))
                logger.info("users table created successfully")
            
            # Now check if password_hash column exists
            column_check = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users' 
                    AND column_name = 'password_hash'
                )
            """))
            column_exists = column_check.scalar()
            
            if not column_exists:
                logger.info("password_hash column does not exist. Adding it now...")
                
                try:
                    # Add the column if it doesn't exist
                    conn.execute(text("""
                        ALTER TABLE users 
                        ADD COLUMN password_hash VARCHAR(255) NOT NULL 
                        DEFAULT '$2b$12$JEQtChVtfJTBb6Z9ZIQ09eKDxcQiKTYQ1x6ZnlR3GZD.aZMg7YHqm'
                    """))
                    
                    conn.execute(text("COMMIT"))
                    logger.info("Successfully added password_hash column")
                except Exception as e:
                    logger.error(f"Error adding password_hash column: {e}")
                    conn.execute(text("ROLLBACK"))
                    raise
            else:
                logger.info("password_hash column already exists")
            
            # Check if admin user exists, create if not
            admin_check = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM users
                    WHERE username = 'admin'
                )
            """))
            admin_exists = admin_check.scalar()
            
            if not admin_exists:
                logger.info("Admin user does not exist. Creating admin user...")
                
                # Create admin user if it doesn't exist
                conn.execute(text("""
                    INSERT INTO users (username, email, is_admin, is_active, password_hash)
                    VALUES ('admin', 'seritec.ingenieria.rd@gmail.com', TRUE, TRUE, '$2b$12$JEQtChVtfJTBb6Z9ZIQ09eKDxcQiKTYQ1x6ZnlR3GZD.aZMg7YHqm')
                """))
                
                conn.execute(text("COMMIT"))
                logger.info("Admin user created successfully")
            else:
                # Update admin user password
                logger.info("Admin user exists. Updating password...")
                conn.execute(text("""
                    UPDATE users
                    SET password_hash = '$2b$12$JEQtChVtfJTBb6Z9ZIQ09eKDxcQiKTYQ1x6ZnlR3GZD.aZMg7YHqm'
                    WHERE username = 'admin'
                """))
                
                conn.execute(text("COMMIT"))
                logger.info("Admin user password updated successfully")
            
            # Also make sure user_preferences table exists
            user_prefs_check = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'user_preferences'
                )
            """))
            user_prefs_exists = user_prefs_check.scalar()
            
            if not user_prefs_exists:
                logger.info("user_preferences table doesn't exist, creating it now")
                
                # Create the user_preferences table
                conn.execute(text("""
                    CREATE TABLE user_preferences (
                        id SERIAL NOT NULL,
                        user_id INTEGER NOT NULL,
                        email_notifications BOOLEAN,
                        PRIMARY KEY (id),
                        UNIQUE (user_id),
                        FOREIGN KEY(user_id) REFERENCES users (id)
                    )
                """))
                
                conn.execute(text("COMMIT"))
                logger.info("user_preferences table created successfully")
            
            # Fix permissions for IAM service account and PUBLIC
            try:
                logger.info("Attempting to fix database permissions...")
                
                # Grant schema permissions
                conn.execute(text("GRANT ALL PRIVILEGES ON SCHEMA public TO PUBLIC"))
                
                # Grant table permissions
                conn.execute(text("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC"))
                
                # Grant sequence permissions
                conn.execute(text("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO PUBLIC"))
                
                # Set default privileges for future tables
                conn.execute(text("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO PUBLIC"))
                
                # Set default privileges for future sequences
                conn.execute(text("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO PUBLIC"))
                
                conn.execute(text("COMMIT"))
                logger.info("Database permissions fixed successfully")
            except Exception as e:
                logger.warning(f"Could not update permissions (this may be expected): {e}")
                conn.execute(text("ROLLBACK"))

            # Display schema and users for verification
            logger.info("Current users table schema:")
            schema = conn.execute(text("""
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'users'
                ORDER BY ordinal_position
            """))
            
            for column in schema:
                logger.info(f"  {column[0]}: {column[1]}" + 
                           (f" (max length: {column[2]})" if column[2] is not None else ""))
            
            logger.info("Current users in database:")
            users = conn.execute(text("SELECT id, username, email, is_admin, is_active FROM users"))
            
            for user in users:
                logger.info(f"  ID: {user[0]}, Username: {user[1]}, Email: {user[2]}, " +
                           f"Admin: {user[3]}, Active: {user[4]}")
                
        return True
    except SQLAlchemyError as e:
        logger.error(f"Database error when fixing schema: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error when fixing schema: {e}")
        return False 