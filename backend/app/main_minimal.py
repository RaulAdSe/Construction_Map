from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import os

app = FastAPI(
    title="Servitec Map API (Minimal)",
    description="Minimal version of the API for deployment testing",
    version="1.0.0",
)

# Configure CORS
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run and load balancers"""
    return {
        "status": "healthy",
        "mode": "minimal",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "environment": os.environ.get("ENVIRONMENT", "unknown")
    }

@app.get("/")
def read_root():
    """Root endpoint that doesn't require database connectivity"""
    env_vars = {
        "PORT": os.environ.get("PORT", "not set"),
        "ENVIRONMENT": os.environ.get("ENVIRONMENT", "not set"),
        "DATABASE_URL": os.environ.get("DATABASE_URL", "not set").replace(":", ":*****@") if os.environ.get("DATABASE_URL") else "not set",
        "CLOUD_DB_CONNECTION_STRING": os.environ.get("CLOUD_DB_CONNECTION_STRING", "not set").replace(":", ":*****@") if os.environ.get("CLOUD_DB_CONNECTION_STRING") else "not set",
        "LOG_LEVEL": os.environ.get("LOG_LEVEL", "not set"),
        "DEBUG": os.environ.get("DEBUG", "not set"),
    }
    
    return {
        "message": "Servitec Map API - Minimal Version",
        "environment": env_vars,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/v1/test")
def test_api():
    """Test endpoint for API validation"""
    return {
        "message": "API test successful",
        "timestamp": datetime.now().isoformat()
    }

# Additional routes can be added here as needed for testing 