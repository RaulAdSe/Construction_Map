#!/usr/bin/env python3
"""
Create Cloud Database Schema Script

This script creates the database schema directly using SQLAlchemy models
without relying on Alembic migrations. This is useful for initializing
a fresh database on Cloud SQL.

Usage:
    python create_cloud_schema.py

Environment variables:
    Make sure your Cloud SQL connection details are properly set in .env.cloud
"""

import os
import sys
from sqlalchemy import inspect

# Add the app directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Load environment variables
if os.path.exists(".env.cloud"):
    print("Loading environment from .env.cloud")
    from dotenv import load_dotenv
    load_dotenv(".env.cloud")

try:
    from app.db.database import engine, Base
    from app.models.user import User
    from app.models.project import Project, ProjectUser
    from app.models.map import Map
    from app.models.event import Event
    from app.models.notification import Notification
    from app.models.user_activity import UserActivity
    
    # Try to import Metric model if it exists
    try:
        from app.models.metric import Metric
        print("Metric model imported successfully")
    except ImportError:
        print("Metric model not found, continuing without it")
    
    try:
        from app.models.user_preference import UserPreference
        print("UserPreference model imported successfully")
    except ImportError:
        print("UserPreference model not found, continuing without it")
        
except ImportError as e:
    print(f"Error importing application modules: {e}")
    print("Make sure you're running this script from the backend directory")
    sys.exit(1)


def check_tables():
    """Check which tables already exist in the database"""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    print(f"Existing tables: {existing_tables}")
    return existing_tables


def create_schema():
    """Create all tables that don't exist"""
    existing_tables = check_tables()
    
    # Create all tables
    print("Creating database schema...")
    Base.metadata.create_all(engine)
    
    # Check tables again to see what was created
    new_tables = [t for t in inspect(engine).get_table_names() if t not in existing_tables]
    if new_tables:
        print(f"Created new tables: {new_tables}")
    else:
        print("No new tables were created - schema is up to date")
    
    print("Database schema creation complete")


if __name__ == "__main__":
    create_schema() 