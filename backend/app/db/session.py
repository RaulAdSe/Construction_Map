from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import logging
from contextlib import contextmanager

from app.core.config import settings

logger = logging.getLogger(__name__)

# Configure SQLAlchemy connection pool
engine = create_engine(
    settings.database.DATABASE_URL,
    pool_pre_ping=True,  # Check connection before using it
    pool_size=settings.database.POOL_SIZE,  # Max connections in pool
    max_overflow=settings.database.POOL_OVERFLOW,  # Max additional connections when pool is full
    pool_timeout=settings.database.POOL_TIMEOUT,  # Timeout for getting connection from pool
    pool_recycle=settings.database.POOL_RECYCLE  # Recycle connections after this many seconds
)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for database models
Base = declarative_base()

def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def get_db_context():
    """Get database session as a context manager."""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()
        logger.error(f"Database error: {str(e)}")
        raise
    finally:
        db.close()

def check_database_connection():
    """Check if database is reachable and ready."""
    try:
        # Try to create a session and execute a simple query
        with get_db_context() as db:
            db.execute("SELECT 1")
        return True
    except Exception as e:
        logger.error(f"Database connection check failed: {str(e)}")
        return False 