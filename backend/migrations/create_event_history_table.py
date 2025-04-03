import os
import sys
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime, JSON, MetaData, Table, text
from sqlalchemy.sql import func

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.config import settings

# Create engine
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
metadata = MetaData()

# Define the event_history table
event_history = Table(
    "event_history",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("event_id", Integer, nullable=False),
    Column("user_id", Integer, nullable=False),
    Column("action_type", String, nullable=False),
    Column("previous_value", String, nullable=True),
    Column("new_value", String, nullable=True),
    Column("additional_data", JSON, nullable=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
)

def run_migration():
    # Create the table
    try:
        # Check if table already exists
        with engine.connect() as conn:
            exists = conn.execute(
                text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'event_history')")
            ).scalar()
            
            if exists:
                print("Table event_history already exists")
                return
            
            # Create just the event_history table - avoid creating foreign keys for now
            conn.execute(text("""
            CREATE TABLE event_history (
                id SERIAL PRIMARY KEY,
                event_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                action_type VARCHAR NOT NULL,
                previous_value VARCHAR,
                new_value VARCHAR,
                additional_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            """))
            print("Created event_history table")
    except Exception as e:
        print(f"Error creating table: {str(e)}")

if __name__ == "__main__":
    run_migration() 