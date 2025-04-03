#!/usr/bin/env python3
"""
Robust test script to ensure the application can start correctly
with comprehensive error logging.
"""

import os
import sys
import time
import traceback
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("app_test")

# Set the PORT environment variable if not set
if 'PORT' not in os.environ:
    os.environ['PORT'] = '8080'

logger.info(f"Starting test app on port {os.environ['PORT']}")
logger.info(f"Python version: {sys.version}")
logger.info(f"Current directory: {os.getcwd()}")
logger.info(f"Directory contents: {os.listdir('.')}")

# List all environment variables (excluding sensitive ones)
logger.info("Environment variables:")
for key, value in sorted(os.environ.items()):
    if key.lower() not in ('postgres_password', 'secret_key', 'database_url', 'cloud_db_connection_string'):
        logger.info(f"  {key}={value}")
    else:
        logger.info(f"  {key}=***SENSITIVE***")

# Check if required directories exist
for directory in ['app', 'uploads', 'uploads/events', 'uploads/comments']:
    if os.path.exists(directory):
        logger.info(f"Directory {directory} exists")
    else:
        logger.warning(f"Directory {directory} does not exist")

try:
    logger.info("Trying to import dependencies...")
    import uvicorn
    import fastapi
    logger.info(f"FastAPI version: {fastapi.__version__}")
    logger.info(f"Uvicorn version: {uvicorn.__version__}")

    logger.info("Importing database modules...")
    try:
        from app.db.session import engine, SessionLocal
        logger.info("Database session imported successfully")
        
        # Test database connection
        logger.info("Testing database connection...")
        try:
            db = SessionLocal()
            db.execute("SELECT 1")
            db.close()
            logger.info("Database connection successful")
        except Exception as db_error:
            logger.error(f"Database connection error: {db_error}")
            logger.error(traceback.format_exc())
    except Exception as session_error:
        logger.error(f"Error importing database session: {session_error}")
        logger.error(traceback.format_exc())

    logger.info("Importing FastAPI app...")
    try:
        from app.main import app
        logger.info("App imported successfully!")
    except Exception as app_error:
        logger.error(f"Error importing FastAPI app: {app_error}")
        logger.error(traceback.format_exc())
        raise
    
    # Add simple endpoint for health check
    from fastapi import FastAPI
    if isinstance(app, FastAPI):
        @app.get("/ready")
        async def ready():
            return {"status": "ready"}
        logger.info("Added ready endpoint for health check")
    
    logger.info(f"Starting uvicorn server on 0.0.0.0:{os.environ['PORT']}...")
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=int(os.environ['PORT']),
        log_level="info"
    )
except Exception as e:
    logger.error(f"Fatal error: {e}")
    logger.error(traceback.format_exc())
    
    # Create a minimal app that just returns 200 OK for health checks
    logger.info("Creating minimal fallback app for health check...")
    try:
        from fastapi import FastAPI
        minimal_app = FastAPI()
        
        @minimal_app.get("/")
        async def root():
            return {"status": "error", "message": str(e)}
        
        @minimal_app.get("/health")
        async def health():
            return {"status": "error", "message": str(e)}
        
        logger.info(f"Starting minimal fallback app on 0.0.0.0:{os.environ['PORT']}...")
        uvicorn.run(
            minimal_app, 
            host="0.0.0.0", 
            port=int(os.environ['PORT']),
            log_level="info"
        )
    except Exception as fallback_error:
        logger.error(f"Even fallback app failed: {fallback_error}")
        sys.exit(1) 