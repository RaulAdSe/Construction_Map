from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os
import uuid
import time
from typing import Optional
from datetime import datetime, timedelta
from fastapi.responses import FileResponse

from api import models, schemas, crud
from api.deps import get_db, get_current_user
from api.routes import events, maps, projects, auth, monitoring
from api.routes.monitoring import track_request_middleware
from api.core.logging import logger
# Import this to activate SQLAlchemy event listeners
import api.core.db_monitoring

# Create the FastAPI app
app = FastAPI(title="Construction Map API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.mount("/events", StaticFiles(directory="uploads/events"), name="events")

# Add a mount for the entire uploads directory
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Add a mount specifically for comment images
app.mount("/comments", StaticFiles(directory="uploads/comments"), name="comments")

# Add a dedicated route for serving event images with authentication
@app.get("/api/v1/image/{image_path:path}")
async def get_image(image_path: str, current_user: models.User = Depends(get_current_user)):
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

# ... existing code ... 