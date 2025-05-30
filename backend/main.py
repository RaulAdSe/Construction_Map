from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os
import uuid
import time
import sys
import traceback
from typing import Optional
from fastapi.responses import FileResponse, JSONResponse, Response

# Import the necessary modules using the correct paths
from api.models import User
from api.deps import get_db, get_current_user
from api.routes import events, maps, projects, auth, monitoring
from api.routes.monitoring import track_request_middleware
from api.core.logging import logger

# Import this to activate SQLAlchemy event listeners
import api.core.db_monitoring

# Define allowed origins
ALLOWED_ORIGINS = [
    "https://construction-map-frontend-ypzdt6srya-uc.a.run.app",
    "https://construction-map-frontend-77413952899.us-central1.run.app",
    "https://coordino.servitecingenieria.com",
    "http://localhost:3000"
]

# Enhanced error handling for startup
try:
    # Create the FastAPI app
    app = FastAPI(title="Construction Map API")
    
    # Add CORS middleware - MORE PERMISSIVE to allow custom domain
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # More permissive - allow all origins
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
        expose_headers=["Content-Length", "Content-Range", "Content-Type", "Content-Disposition", "X-Total-Count"],
        max_age=600,  # Cache preflight requests for 10 minutes
    )
    
    # Add a middleware to handle CORS with specific origins
    @app.middleware("http")
    async def cors_middleware(request: Request, call_next):
        # Process the request
        response = await call_next(request)
        
        # Get origin from request
        origin = request.headers.get("origin", "")
        
        # Exact match for allowed origins, with special focus on coordino domain
        if origin == "https://coordino.servitecingenieria.com" or origin == "http://localhost:3000":
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Expose-Headers"] = "Content-Length, Content-Range, Content-Type, Content-Disposition, X-Total-Count"
            
        # Always set Vary: Origin
        response.headers["Vary"] = "Origin"
        
        return response
    
    # Add explicit OPTIONS route handler for CORS preflight requests
    @app.options("/{full_path:path}")
    async def options_route(request: Request, full_path: str):
        origin = request.headers.get("origin", "")
        
        # Create response with appropriate headers
        response = Response(content="", status_code=200)
        
        # Exact match for allowed origins, with special focus on coordino domain
        if origin == "https://coordino.servitecingenieria.com" or origin == "http://localhost:3000":
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Expose-Headers"] = "Content-Length, Content-Range, Content-Type, Content-Disposition, X-Total-Count"
            response.headers["Access-Control-Max-Age"] = "600"  # Cache preflight for 10 minutes
            
        # Always set Vary: Origin
        response.headers["Vary"] = "Origin"
        
        return response

    # Add global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        # Determine status code
        status_code = 500
        if hasattr(exc, "status_code"):
            status_code = exc.status_code
        
        # Log the detailed error
        error_msg = f"Global exception handler caught: {str(exc)}"
        print(error_msg)
        print(f"Traceback: {traceback.format_exc()}")
        
        return JSONResponse(
            status_code=status_code,
            content={"detail": str(exc)}
        )

    # Add logging middleware
    @app.middleware("http")
    async def logging_middleware(request: Request, call_next):
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        # Add request_id to request state for use in route handlers
        request.state.request_id = request_id
        
        # Process the request
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Log successful request
            logger.info(
                f"Request completed: {request.method} {request.url.path}",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round(process_time * 1000, 2),
                    "user_agent": request.headers.get("user-agent"),
                    "client_ip": request.client.host
                }
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as e:
            # Log failed request
            process_time = time.time() - start_time
            logger.error(
                f"Request failed: {request.method} {request.url.path}",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "error": str(e),
                    "duration_ms": round(process_time * 1000, 2),
                    "user_agent": request.headers.get("user-agent"),
                    "client_ip": request.client.host
                }
            )
            raise

    # Add request tracking middleware for metrics
    app.middleware("http")(track_request_middleware)

    # Include routers
    app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
    app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
    app.include_router(maps.router, prefix="/api/v1/maps", tags=["maps"])
    app.include_router(events.router, prefix="/api/v1/events", tags=["events"])
    app.include_router(monitoring.router, prefix="/api/v1/monitoring", tags=["monitoring"])

    # Serve static files from the uploads/events directory with the correct path
    # Since the server runs from /backend, we need to use the correct relative path
    if not os.path.exists("uploads/events"):
        os.makedirs("uploads/events", exist_ok=True)
    app.mount("/events", StaticFiles(directory="uploads/events"), name="events")

    # Add a mount for the entire uploads directory
    if not os.path.exists("uploads"):
        os.makedirs("uploads", exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

    # Add a dedicated mount specifically for comment images
    if not os.path.exists("uploads/comments"):
        os.makedirs("uploads/comments", exist_ok=True)
    app.mount("/comments", StaticFiles(directory="uploads/comments"), name="comments")

    # Add a dedicated route for serving event images with authentication
    @app.get("/api/v1/image/{image_path:path}")
    async def get_image(image_path: str, current_user: User = Depends(get_current_user)):
        # Check if the file exists - use the correct relative path
        file_path = os.path.join("uploads/events", image_path)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Image not found: {file_path}")
        
        # Return the file
        return FileResponse(file_path)

    # Root endpoint with health status
    @app.get("/")
    async def root():
        return {
            "name": "Construction Map API",
            "status": "online",
            "version": "1.0.0",
            "docs": "/docs"
        }
        
    # Health check endpoint
    @app.get("/health")
    async def health():
        return {
            "status": "healthy",
            "timestamp": time.time()
        }
        
    # Print initialization complete message
    logger.info("API initialization complete")
    
except Exception as e:
    logger.error(f"CRITICAL ERROR DURING STARTUP: {str(e)}")
    logger.error(traceback.format_exc())
    # Don't re-raise to allow normal shutdown procedures 