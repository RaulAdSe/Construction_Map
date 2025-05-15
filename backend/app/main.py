from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import sys
import traceback
import logging
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.api.v1.api import api_router
from app.db.database import get_db
# Import the db_monitoring module to activate SQLAlchemy event listeners
import app.core.db_monitoring

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("logs/main.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("main")

logger.info("Starting application initialization...")

try:
    # Initialize FastAPI app
    app = FastAPI(
        title="Construction Map API",
        description="API for the Construction Map application",
        version="1.0.0",
    )

    # Configure CORS - development settings
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://0.0.0.0:8080",
        "http://0.0.0.0:3000"
    ]

    # CORS middleware configuration with proper settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:[0-9]+)?",
        allow_credentials=True,
        allow_methods=["*"],  # Allow all methods
        allow_headers=["*"],  # Allow all headers
        expose_headers=["Content-Length", "Content-Range", "Content-Type", "Content-Disposition",
                        "X-Total-Count", "Access-Control-Allow-Origin"],
        max_age=600,  # Cache preflight requests for 10 minutes
    )

    # Test database connection before initializing API routes
    @app.on_event("startup")
    async def startup_db_client():
        logger.info("Testing database connection on startup...")
        try:
            db = next(get_db())
            # Try a simple query - properly using SQLAlchemy text() function
            result = db.execute(text("SELECT 1")).scalar()
            if result == 1:
                logger.info("Database connection successful!")
            else:
                logger.error("Database connection test returned unexpected result")
        except Exception as e:
            logger.error(f"Database connection failed: {str(e)}")
            logger.error(traceback.format_exc())
        finally:
            db.close()

    # Include API router
    app.include_router(api_router, prefix="/api/v1")

    # Mount uploads directory for static files
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
        logger.info(f"Created uploads directory: {uploads_dir}")
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

    # Ensure event and comment upload directories exist
    events_dir = os.path.join(uploads_dir, "events")
    comments_dir = os.path.join(uploads_dir, "comments")
    if not os.path.exists(events_dir):
        os.makedirs(events_dir)
        logger.info(f"Created events directory: {events_dir}")
    if not os.path.exists(comments_dir):
        os.makedirs(comments_dir)
        logger.info(f"Created comments directory: {comments_dir}")

    # Also mount them directly to support both path formats
    app.mount("/events", StaticFiles(directory=events_dir), name="events")
    app.mount("/comments", StaticFiles(directory=comments_dir), name="comments")

    @app.get("/health")
    def health_check():
        """Endpoint to check if the API is running"""
        return {"status": "healthy", "message": "API is running"}

    @app.get("/")
    def read_root():
        return {"message": "Welcome to the Construction Map API"}

    logger.info("Application initialization completed successfully")

except Exception as e:
    logger.critical(f"Failed to initialize application: {str(e)}")
    logger.critical(traceback.format_exc())
    raise
