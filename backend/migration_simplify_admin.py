import os
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings

def run_migration():
    """
    Run SQL migrations to:
    1. Add is_admin boolean column to users table
    2. Migrate data from role column to is_admin (where role = 'admin')
    3. Remove role column from users table
    4. Migrate data from project_users.role to update global is_admin status
    5. Remove role column from project_users table
    """
    print("Starting database migration for admin simplification...")
    
    try:
        # Create engine
        engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
        conn = engine.connect()
        
        # 1. Add is_admin column if it doesn't exist
        check_admin_column = text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='users' AND column_name='is_admin';
        """)
        
        if conn.execute(check_admin_column).rowcount == 0:
            print("Adding is_admin column to users table...")
            add_admin_column = text("""
            ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
            """)
            conn.execute(add_admin_column)
        
        # 2. Migrate data from role column
        check_role_column = text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='users' AND column_name='role';
        """)
        
        if conn.execute(check_role_column).rowcount > 0:
            print("Migrating data from role column to is_admin...")
            migrate_data = text("""
            UPDATE users SET is_admin = TRUE WHERE role = 'admin';
            """)
            conn.execute(migrate_data)
            
            # 3. Drop role column
            print("Removing role column from users table...")
            drop_role_column = text("""
            ALTER TABLE users DROP COLUMN IF EXISTS role;
            """)
            conn.execute(drop_role_column)
        
        # 4. Check if project_users.role exists
        check_project_role = text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='project_users' AND column_name='role';
        """)
        
        if conn.execute(check_project_role).rowcount > 0:
            # Update global admin status for users who were project admins
            print("Updating global admin status from project roles...")
            update_admin_status = text("""
            UPDATE users SET is_admin = TRUE 
            FROM project_users 
            WHERE users.id = project_users.user_id 
            AND project_users.role = 'ADMIN';
            """)
            conn.execute(update_admin_status)
            
            # 5. Drop role column from project_users
            print("Removing role column from project_users table...")
            drop_project_role = text("""
            ALTER TABLE project_users DROP COLUMN IF EXISTS role;
            """)
            conn.execute(drop_project_role)
        
        # Commit all changes
        conn.commit()
        conn.close()
        print("Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"Error running migration: {e}")
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1) 