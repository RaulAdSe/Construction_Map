#!/usr/bin/env python3
"""
Minimal FastAPI application for health checks.
This is used when troubleshooting more complex application startup issues.
"""

import os
import sys
import logging
from fastapi import FastAPI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("minimal_app")

# Set default port
port = int(os.environ.get("PORT", 8080))
logger.info(f"Starting minimal app on port {port}")

# Create minimal FastAPI app
app = FastAPI(
    title="Minimal API", 
    description="Minimal API for health checks"
)

@app.get("/")
async def root():
    logger.info("Root endpoint called")
    return {"status": "minimal app running", "message": "This is a minimal app for troubleshooting"}

@app.get("/health")
async def health():
    logger.info("Health endpoint called")
    return {"status": "healthy", "message": "Minimal app is healthy"}

@app.get("/ready")
async def ready():
    logger.info("Ready endpoint called")
    return {"status": "ready", "message": "Minimal app is ready"}

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting uvicorn server on 0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info") 