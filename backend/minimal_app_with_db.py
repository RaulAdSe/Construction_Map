#!/usr/bin/env python3
"""
Minimal FastAPI application with database connectivity.
This adds SQLAlchemy database connection to the minimal app.
"""

import os
import sys
import logging
from datetime import datetime
from typing import List, Optional
import urllib.parse

from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from sqlalchemy import create_engine, Column, Integer, String, DateTime, func, select
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("minimal_app_with_db")

# Set the PORT environment variable if not set
port = int(os.environ.get("PORT", 8080))
logger.info(f"Starting minimal app with DB on port {port}")

# Database configuration
# Get database credentials from environment variables
db_host = os.environ.get("DB_HOST")
db_port = os.environ.get("DB_PORT", "5432")
db_name = os.environ.get("DB_NAME")
db_user = os.environ.get("DB_USER")
db_pass = os.environ.get("DB_PASS")

# Build DATABASE_URL if individual components are provided
if db_host and db_name and db_user and db_pass:
    # URL encode the password to handle special characters
    encoded_password = urllib.parse.quote_plus(db_pass)
    DB_URL = f"postgresql://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"
    logger.info(f"Built database connection string from environment variables with URL-encoded password")
else:
    # Fallback to direct DATABASE_URL if provided
    DB_URL = os.environ.get("DATABASE_URL")
    if DB_URL:
        logger.info("Using DATABASE_URL from environment")
    else:
        # Last resort default with encoded password
        password = "H6o$-Tt6U@>oBIfU"
        encoded_password = urllib.parse.quote_plus(password)
        DB_URL = f"postgresql://postgres:{encoded_password}@34.123.51.251:5432/servitec_map"
        logger.info("Using default DATABASE_URL with encoded password")

# Mask sensitive info in logs
if '@' in DB_URL:
    masked_url = DB_URL.replace("://", "://***:***@").split("@")[0] + "@" + DB_URL.split("@")[-1]
    logger.info(f"Using database URL: {masked_url}")
else:
    logger.info(f"Using database URL: [MASKED]")

# Create Base class for models
Base = declarative_base()

# Define a simple model
class HealthCheck(Base):
    __tablename__ = "health_checks"

    id = Column(Integer, primary_key=True, index=True)
    service = Column(String, index=True)
    status = Column(String)
    message = Column(String)
    created_at = Column(DateTime, default=func.now())

# Create a minimal FastAPI app
app = FastAPI(
    title="Minimal API with Database",
    description="Minimal API with database connectivity for Cloud Run",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database connection - wrapped in try/except
engine = None
SessionLocal = None

def init_db():
    global engine, SessionLocal
    try:
        # Add connection timeout parameters
        db_url = DB_URL
        if '?' in db_url:
            db_url += "&connect_timeout=5"
        else:
            db_url += "?connect_timeout=5"

        logger.info(f"Connecting to database at {db_url.split('@')[-1].split('/')[0]}")
        
        # Create SQLAlchemy engine with connect_args for timeout
        engine = create_engine(
            db_url, 
            connect_args={"connect_timeout": 10},
            pool_pre_ping=True
        )

        # Create session factory
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        # Test connection
        with engine.connect() as conn:
            conn.execute(select(func.now()))
            logger.info("Database connection established successfully")
        
        # Create tables - handle failure gracefully
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables created successfully (or already exist)")
        except Exception as e:
            logger.error(f"Error creating database tables: {e}")
            logger.error("Continuing without database tables")
        
        return True
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        logger.error(f"Connection parameters (masked): host={db_url.split('@')[-1].split('/')[0]}, db={db_url.split('/')[-1].split('?')[0]}")
        return False

# Initialize database in the background - this ensures app startup
# even if database is not available
import threading
threading.Thread(target=init_db, daemon=True).start()

# Dependency to get DB session
def get_db():
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database connection not available")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
async def root():
    logger.info("Root endpoint called")
    return {
        "message": "Minimal API with database is running",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health(request: Request):
    logger.info("Health endpoint called")
    
    # First return basic health info without database dependency
    # This ensures the health check passes even if DB is unavailable
    health_response = {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "database_status": "not_initialized" if SessionLocal is None else "initialized"
    }
    
    # If database is available, try to use it
    if SessionLocal is not None:
        try:
            db = SessionLocal()
            
            # Insert a health check record
            health_check = HealthCheck(
                service="minimal-app",
                status="healthy",
                message="Health check endpoint called"
            )
            db.add(health_check)
            db.commit()
            db.refresh(health_check)
            
            # Get the last 5 health checks
            health_checks = db.query(HealthCheck).order_by(HealthCheck.created_at.desc()).limit(5).all()
            
            health_response["database"] = "connected"
            health_response["recent_checks"] = [
                {
                    "id": hc.id, 
                    "status": hc.status, 
                    "created_at": hc.created_at.isoformat() if hc.created_at else None
                } 
                for hc in health_checks
            ]
            
            db.close()
        except Exception as e:
            logger.error(f"Database error in health check: {e}")
            health_response["database"] = "error"
            health_response["error"] = str(e)
    
    return health_response

@app.get("/api/v1/test")
async def test():
    logger.info("Test endpoint called")
    
    # Always return app status first
    response = {
        "message": "API test endpoint is working",
        "app_time": datetime.now().isoformat(),
        "database_initialized": SessionLocal is not None
    }
    
    # Try to test the database if initialized
    if SessionLocal is not None:
        try:
            db = SessionLocal()
            # Test query
            result = db.execute(select(func.now())).scalar()
            response["database_time"] = result.isoformat() if result else None
            response["database_status"] = "connected"
            db.close()
        except Exception as e:
            logger.error(f"Database error in test: {e}")
            response["database_status"] = "error"
            response["error"] = str(e)
    else:
        response["database_status"] = "not_initialized"
    
    return response

@app.get("/api/v1/debug")
async def debug(request: Request):
    """Return debug information about the environment"""
    logger.info("Debug endpoint called")
    
    # Collect environment variables (hide sensitive ones)
    env_vars = {}
    for key, value in os.environ.items():
        if key.lower() in ('postgres_password', 'secret_key', 'database_url', 'db_pass'):
            env_vars[key] = "***SENSITIVE***"
        else:
            env_vars[key] = value
    
    # Test database connection without exposing details
    db_status = "not_initialized"
    if SessionLocal is not None:
        try:
            db = SessionLocal()
            db.execute(select(func.now())).scalar()
            db.close()
            db_status = "connected"
        except Exception as e:
            db_status = f"error: {str(e)}"
    
    # Return debug info
    return {
        "timestamp": datetime.now().isoformat(),
        "database_status": db_status,
        "environment": env_vars,
        "headers": dict(request.headers),
        "client": {
            "host": request.client.host if request.client else None,
            "port": request.client.port if request.client else None,
        }
    }

if __name__ == "__main__":
    # Make sure the app starts even if database connection fails
    uvicorn.run(app, host="0.0.0.0", port=port) 