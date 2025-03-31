import os
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings

def run_migration():
    """
    Run SQL migrations to add the 'field' column to the project_users table.
    """
    print("Starting database migration...")
    
    try:
        # Create engine
        engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
        conn = engine.connect()
        
        # Check if field column exists
        check_query = text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='project_users' AND column_name='field';
        """)
        
        result = conn.execute(check_query)
        column_exists = result.rowcount > 0
        
        if column_exists:
            print("Field column already exists in project_users table.")
        else:
            # Add field column
            alter_query = text("""
            ALTER TABLE project_users 
            ADD COLUMN field VARCHAR(255) NULL;
            """)
            
            conn.execute(alter_query)
            print("Successfully added 'field' column to project_users table.")
        
        conn.commit()
        conn.close()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error running migration: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1) 