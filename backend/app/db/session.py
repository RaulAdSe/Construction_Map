import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create SQLAlchemy engine
engine = create_engine(settings.DATABASE_URI, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database with schema fixes that don't require ownership"""
    try:
        # Skip schema updates if the flag is set
        if os.environ.get("SKIP_DB_SCHEMA_UPDATE") == "true":
            logger.warning("Skipping schema updates due to SKIP_DB_SCHEMA_UPDATE flag")
            return
        
        # Check if password_hash column exists
        with engine.connect() as connection:
            try:
                result = connection.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'users' 
                        AND column_name = 'password_hash'
                    )
                """))
                has_password_hash = result.scalar()
                
                if not has_password_hash:
                    logger.info("Attempting to add password_hash column to users table")
                    try:
                        connection.execute(text("""
                            ALTER TABLE users 
                            ADD COLUMN password_hash VARCHAR(255) NOT NULL
                            DEFAULT '$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By '
                        """))
                        connection.commit()
                        logger.info("Successfully added password_hash column")
                    except Exception as e:
                        logger.error(f"Database error when fixing schema: {e}")
                        connection.rollback()
                        logger.warning("Schema fix may have failed, but continuing anyway")
                else:
                    logger.info("password_hash column already exists")
            
            except Exception as e:
                logger.error(f"Error checking database schema: {e}")
                connection.rollback()
    
    except Exception as e:
        logger.error(f"Database initialization error: {e}") 