import os
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings

def run_migration():
    """
    Run SQL migrations to create the 'notifications' table.
    """
    print("Starting notifications table migration...")
    
    try:
        # Create engine
        engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
        conn = engine.connect()
        
        # Check if notifications table exists
        check_query = text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'notifications';
        """)
        
        result = conn.execute(check_query)
        table_exists = result.rowcount > 0
        
        if table_exists:
            print("Notifications table already exists.")
        else:
            # Create notifications table
            create_query = text("""
            CREATE TABLE notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                message TEXT NOT NULL,
                link VARCHAR(255) NOT NULL,
                notification_type VARCHAR(50) NOT NULL,
                read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                event_id INTEGER REFERENCES events(id),
                comment_id INTEGER REFERENCES event_comments(id)
            );
            """)
            
            conn.execute(create_query)
            print("Successfully created 'notifications' table.")
        
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