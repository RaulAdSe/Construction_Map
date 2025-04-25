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
from fastapi.responses import JSONResponse
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi import Request

from app.api.v1.api import api_router
from app.db.database import get_db
# Import the db_monitoring module to activate SQLAlchemy event listeners
import app.core.db_monitoring

# Determine if running in Cloud Run for logging configuration
in_cloud_run = os.getenv("K_SERVICE") is not None

# Configure logging without file handlers in Cloud Run, since the filesystem is read-only
logging_handlers = []

# Always add stdout handler
logging_handlers.append(logging.StreamHandler(sys.stdout))

# Only add file handler if not in Cloud Run or if the directory exists and is writable
log_file_path = "logs/main.log"
try:
    log_dir = os.path.dirname(log_file_path)
    if not in_cloud_run or (os.path.exists(log_dir) and os.access(log_dir, os.W_OK)):
        os.makedirs(log_dir, exist_ok=True)
        logging_handlers.append(logging.FileHandler(log_file_path))
except (OSError, PermissionError) as e:
    # If we can't create or access the log directory, just log to stdout
    print(f"Could not configure file logging: {str(e)}. Using stdout only.")

# Now configure logging with the appropriate handlers
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=logging_handlers
)

logger = logging.getLogger("main")

logger.info("Starting application initialization...")
if in_cloud_run:
    logger.info("Running in Cloud Run environment")
else:
    logger.info("Running in local environment")

try:
    # Initialize FastAPI app
    app = FastAPI(
        title="Construction Map API",
        description="API for the Construction Map application",
        version="1.0.0",
    )

    # Add HTTPS redirect middleware in production
    if in_cloud_run:
        logger.info("Adding HTTPS redirect middleware for production")
        # app.add_middleware(HTTPSRedirectMiddleware)  # Commented out to prevent redirect loops

    # Configure CORS - production settings with HTTPS only
    origins = [
        # Current frontend domain
        "https://construction-map-frontend-ypzdt6srya-uc.a.run.app",
        "https://www.construction-map-frontend-ypzdt6srya-uc.a.run.app",
        # Previous frontend domain
        "https://construction-map-frontend-77413952899.us-central1.run.app",
        # Any subdomain of construction-map-frontend
        "https://*.construction-map-frontend-ypzdt6srya-uc.a.run.app",
        # Allow all Cloud Run domains for flexibility
        "https://*.run.app"
    ]
    
    # Only add HTTP origins for local development
    if not in_cloud_run:
        logger.info("Adding HTTP origins for local development")
        origins.extend([
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        ])

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  # Explicit methods
        allow_headers=["*"],  # Allow all headers
        expose_headers=["Content-Length", "Content-Range", "Content-Type", "Content-Disposition",
                        "X-Total-Count", "Access-Control-Allow-Origin"],
        max_age=600,  # Cache preflight requests for 10 minutes
    )

    # Add a custom middleware to ensure proper HTTPS headers
    @app.middleware("http")
    async def add_cors_headers_to_errors(request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            # Log the full error for debugging
            print(f"Unhandled error: {str(exc)}")
            print(f"Traceback: {traceback.format_exc()}")
            
            # Get the origin from the request
            origin = request.headers.get("origin", "https://construction-map-frontend-ypzdt6srya-uc.a.run.app")
            
            # Create a proper error response with CORS headers
            return JSONResponse(
                status_code=500,
                content={"detail": str(exc)},
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "*",
                    "Access-Control-Allow-Headers": "*",
                }
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
                
                # Also check if tables exist - particularly users table
                try:
                    from sqlalchemy import inspect
                    from app.db.database import engine
                    
                    inspector = inspect(engine)
                    tables = inspector.get_table_names()
                    logger.info(f"Database tables: {tables}")
                    
                    if 'users' not in tables:
                        logger.error("CRITICAL: 'users' table not found in database!")
                        logger.error("The application will not function properly.")
                        logger.error("Please run create_cloud_schema.py to create the database schema.")
                    else:
                        # Check how many users exist
                        user_count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
                        logger.info(f"Number of users in database: {user_count}")
                        
                        # Check if admin user exists
                        admin_exists = db.execute(text("SELECT COUNT(*) FROM users WHERE username = 'admin'")).scalar()
                        logger.info(f"Admin user exists: {admin_exists > 0}")
                except Exception as table_error:
                    logger.error(f"Error checking database tables: {str(table_error)}")
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
    try:
        if not os.path.exists(uploads_dir):
            os.makedirs(uploads_dir)
            logger.info(f"Created uploads directory: {uploads_dir}")
    except PermissionError:
        logger.warning(f"Cannot create uploads directory (read-only filesystem): {uploads_dir}")
    except OSError as e:
        logger.warning(f"Error creating uploads directory: {str(e)}")
    
    # Only mount if the directory exists
    if os.path.exists(uploads_dir):
        app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
    else:
        logger.warning("Uploads directory does not exist. Static file mounting for uploads skipped.")

    # Ensure event and comment upload directories exist
    events_dir = os.path.join(uploads_dir, "events")
    comments_dir = os.path.join(uploads_dir, "comments")
    
    try:
        if not os.path.exists(events_dir):
            os.makedirs(events_dir)
            logger.info(f"Created events directory: {events_dir}")
    except PermissionError:
        logger.warning(f"Cannot create events directory (read-only filesystem): {events_dir}")
    except OSError as e:
        logger.warning(f"Error creating events directory: {str(e)}")
    
    try:
        if not os.path.exists(comments_dir):
            os.makedirs(comments_dir)
            logger.info(f"Created comments directory: {comments_dir}")
    except PermissionError:
        logger.warning(f"Cannot create comments directory (read-only filesystem): {comments_dir}")
    except OSError as e:
        logger.warning(f"Error creating comments directory: {str(e)}")

    # Only mount directories that exist
    if os.path.exists(events_dir):
        app.mount("/events", StaticFiles(directory=events_dir), name="events")
    else:
        logger.warning("Events directory does not exist. Static file mounting for events skipped.")
        
    if os.path.exists(comments_dir):
        app.mount("/comments", StaticFiles(directory=comments_dir), name="comments")
    else:
        logger.warning("Comments directory does not exist. Static file mounting for comments skipped.")

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
