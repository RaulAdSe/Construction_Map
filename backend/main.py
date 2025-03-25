from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os
from typing import Optional
from datetime import datetime, timedelta
from fastapi.responses import FileResponse

# ... existing code ...

# Add a dedicated route for serving event images with authentication
@app.get("/api/v1/image/{image_path:path}")
async def get_image(image_path: str, current_user: models.User = Depends(get_current_user)):
    # Check if the file exists
    file_path = os.path.join("events", image_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Return the file
    return FileResponse(file_path)

# ... existing code ... 