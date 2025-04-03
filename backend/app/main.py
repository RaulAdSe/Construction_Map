from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, StreamingResponse
import os
import io
import logging

from app.api.v1.api import api_router
# Import the db_monitoring module to activate SQLAlchemy event listeners
import app.core.db_monitoring
from app.core.storage import storage_service

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Construction Map API",
    description="API for the Construction Map application",
    version="1.0.0",
)

# Configure CORS - more direct approach
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With", 
                   "Access-Control-Request-Method", "Access-Control-Request-Headers", 
                   "X-CSRF-Token", "Cache-Control", "X-Requested-With", "If-Modified-Since"],
    expose_headers=["Content-Length", "Content-Range", "Content-Type", "Content-Disposition",
                    "X-Total-Count", "Access-Control-Allow-Origin"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Include API router
app.include_router(api_router, prefix="/api/v1")

# Create a custom handler to proxy cloud storage requests when needed
@app.get("/uploads/{file_path:path}")
async def get_upload(file_path: str):
    # Check if we're using cloud storage and file exists locally
    if storage_service.cloud_storage_enabled:
        # Attempt to get URL from cloud storage
        cloud_url = storage_service.get_file_url(file_path)
        if cloud_url and cloud_url != f"/uploads/{file_path}":
            return RedirectResponse(url=cloud_url)
    
    # Fall back to local file (will be handled by the StaticFiles mount)
    return None

# Mount uploads directory for static files
uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Ensure event and comment upload directories exist
events_dir = os.path.join(uploads_dir, "events")
comments_dir = os.path.join(uploads_dir, "comments")
if not os.path.exists(events_dir):
    os.makedirs(events_dir)
if not os.path.exists(comments_dir):
    os.makedirs(comments_dir)

# Also mount them directly to support both path formats
app.mount("/events", StaticFiles(directory=events_dir), name="events")
app.mount("/comments", StaticFiles(directory=comments_dir), name="comments")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Construction Map API"}
