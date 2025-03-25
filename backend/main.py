from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os
from typing import Optional
from datetime import datetime, timedelta
from fastapi.responses import FileResponse

from api import models, schemas, crud
from api.deps import get_db, get_current_user
from api.routes import events, maps, projects, auth

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

# Include routers
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(maps.router, prefix="/api/v1/maps", tags=["maps"])
app.include_router(events.router, prefix="/api/v1/events", tags=["events"])

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

# ... existing code ... 