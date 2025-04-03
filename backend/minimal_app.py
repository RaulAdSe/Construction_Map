#!/usr/bin/env python3
"""
Bare minimum FastAPI application for Cloud Run.
This will be used if the main application fails to start.
"""

import os
import sys
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("minimal_app")

# Set the PORT environment variable if not set
port = int(os.environ.get("PORT", 8080))
logger.info(f"Starting minimal app on port {port}")

# Create a minimal FastAPI app
app = FastAPI(
    title="Minimal API",
    description="Minimal API for Cloud Run",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    logger.info("Root endpoint called")
    return {
        "message": "Minimal API is running",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health():
    logger.info("Health endpoint called")
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/v1/test")
async def test():
    logger.info("Test endpoint called")
    return {
        "message": "API test endpoint is working",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/v1/debug")
async def debug(request: Request):
    """Return debug information about the environment"""
    logger.info("Debug endpoint called")
    
    # Collect environment variables (hide sensitive ones)
    env_vars = {}
    for key, value in os.environ.items():
        if key.lower() in ('postgres_password', 'secret_key', 'database_url'):
            env_vars[key] = "***SENSITIVE***"
        else:
            env_vars[key] = value
    
    # Return debug info
    return {
        "timestamp": datetime.now().isoformat(),
        "environment": env_vars,
        "headers": dict(request.headers),
        "client": {
            "host": request.client.host if request.client else None,
            "port": request.client.port if request.client else None,
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=port) 