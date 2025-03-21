from sqlalchemy import create_engine, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import time

from app.core.config import settings
import os

# Function to create database if it doesn't exist
def create_database_if_not_exists():
    for attempt in range(3):  # Try up to 3 times
        try:
            # Connect to the default postgres database
            conn = psycopg2.connect(
                host=settings.POSTGRES_SERVER,
                port=settings.POSTGRES_PORT,
                user=settings.POSTGRES_USER,
                password=settings.POSTGRES_PASSWORD,
                database='postgres'  # Connect to default postgres database
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            cursor = conn.cursor()
            
            # Check if our target database exists
            cursor.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{settings.POSTGRES_DB}'")
            exists = cursor.fetchone()
            
            if not exists:
                print(f"Creating database {settings.POSTGRES_DB}...")
                cursor.execute(f"CREATE DATABASE {settings.POSTGRES_DB}")
                print(f"Database {settings.POSTGRES_DB} created successfully.")
            else:
                print(f"Database {settings.POSTGRES_DB} already exists.")
            
            cursor.close()
            conn.close()
            return True
        except Exception as e:
            print(f"Database connection attempt {attempt+1} failed: {e}")
            if attempt < 2:  # Don't sleep on the last attempt
                time.sleep(2)  # Wait a bit before trying again
    
    print("Could not connect to the database after multiple attempts.")
    return False

# Create uploads directory if it doesn't exist
os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)

# Try to create the database if it doesn't exist
print("Checking/creating database...")
create_database_if_not_exists()

# Create SQLAlchemy engine
print(f"Using database URI: {settings.SQLALCHEMY_DATABASE_URI}")
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
