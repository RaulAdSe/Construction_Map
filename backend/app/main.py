from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api.v1.api import api_router
# Import the db_monitoring module to activate SQLAlchemy event listeners
import app.core.db_monitoring

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
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
)

# Include API router
app.include_router(api_router, prefix="/api/v1")

# Mount uploads directory for static files
uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Serve static files for uploads, events and comments
app.mount("/events", StaticFiles(directory="uploads/events"), name="events")
app.mount("/comments", StaticFiles(directory="uploads/comments"), name="comments")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Construction Map API"}
