from app.db.database import engine
from sqlalchemy import text

def check_tables():
    print("Checking database tables...")
    with engine.connect() as conn:
        # Get all tables in the database
        result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
        tables = [row[0] for row in result]
        
        print("-- Tables in database --")
        for table in tables:
            print(table)
        
        # Direct check for event_history table
        print("\n-- Direct check for event_history table --")
        try:
            result = conn.execute(text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_history')"))
            exists = result.scalar()
            print(f"event_history table exists: {exists}")
            
            # Also check with lowercase
            result = conn.execute(text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND lower(table_name) = 'event_history')"))
            exists_lower = result.scalar()
            print(f"event_history table exists (case insensitive): {exists_lower}")
            
            # Try to query the table directly
            try:
                result = conn.execute(text("SELECT COUNT(*) FROM event_history"))
                count = result.scalar()
                print(f"event_history table has {count} records")
                
                if count > 0:
                    print("\n-- Sample records from event_history --")
                    result = conn.execute(text("SELECT * FROM event_history ORDER BY created_at DESC LIMIT 5"))
                    columns = result.keys()
                    for row in result:
                        print({col: row[col] for col in columns})
            except Exception as e:
                print(f"Error querying event_history table: {str(e)}")
        except Exception as e:
            print(f"Error checking for event_history table: {str(e)}")

if __name__ == "__main__":
    check_tables() 