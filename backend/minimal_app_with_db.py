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
DB_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:4%7CYD%7D%54l4npU1d%22M%24@34.123.51.251:5432/servitec_map")
logger.info(f"Using database URL: {DB_URL.replace('postgres:', 'postgres:***')}")

# Add connection timeout parameters
if '?' in DB_URL:
    DB_URL += "&connect_timeout=5"
else:
    DB_URL += "?connect_timeout=5"

# Create SQLAlchemy engine with connect_args for timeout
engine = create_engine(
    DB_URL, 
    connect_args={
        "connect_timeout": 10
    },
    pool_pre_ping=True
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

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

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create tables - handle failure gracefully
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully (or already exist)")
except Exception as e:
    logger.error(f"Error creating database tables: {e}")
    logger.error("Continuing without database tables")

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

@app.get("/")
async def root():
    logger.info("Root endpoint called")
    return {
        "message": "Minimal API with database is running",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health(db: Session = Depends(get_db)):
    logger.info("Health endpoint called")
    
    # Try to interact with the database
    try:
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
        
        return {
            "status": "healthy",
            "database": "connected",
            "version": "1.0.0",
            "timestamp": datetime.now().isoformat(),
            "recent_checks": [
                {
                    "id": hc.id, 
                    "status": hc.status, 
                    "created_at": hc.created_at.isoformat() if hc.created_at else None
                } 
                for hc in health_checks
            ]
        }
    except Exception as e:
        logger.error(f"Database error in health check: {e}")
        return {
            "status": "unhealthy",
            "database": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/v1/test")
async def test(db: Session = Depends(get_db)):
    logger.info("Test endpoint called")
    
    # Try to test the database
    try:
        # Test query
        result = db.execute(select(func.now())).scalar()
        
        return {
            "message": "API test endpoint is working",
            "database_time": result.isoformat() if result else None,
            "app_time": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Database error in test: {e}")
        return {
            "message": "API test endpoint is working, but database connection failed",
            "error": str(e),
            "app_time": datetime.now().isoformat()
        }

@app.get("/api/v1/debug")
async def debug(request: Request):
    """Return debug information about the environment"""
    logger.info("Debug endpoint called")
    
    # Collect environment variables (hide sensitive ones)
    env_vars = {}
    for key, value in os.environ.items():
        if key.lower() in ('postgres_password', 'secret_key', 'database_url'):
            env_vars[key] = "***SENSITIVE***"
        else:
            env_vars[key] = value
    
    # Test database connection without exposing details
    db_status = "unknown"
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
    uvicorn.run(app, host="0.0.0.0", port=port) 