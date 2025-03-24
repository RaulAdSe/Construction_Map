#!/usr/bin/env python3
"""
Run script for the backend server with better error handling.
"""
import os
import sys
import logging
import traceback
from pathlib import Path

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("backend_server")

try:
    logger.debug("Current directory: %s", os.getcwd())
    logger.debug("Python executable: %s", sys.executable)
    
    # Get absolute path to the backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    logger.debug("Backend directory: %s", backend_dir)
    
    # Add backend directory to Python path
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
        logger.debug("Added backend directory to Python path")
    
    logger.debug("Python path: %s", sys.path)
    
    # Check if app directory exists
    app_dir = os.path.join(backend_dir, "app")
    if os.path.exists(app_dir):
        logger.debug("app directory exists, contents: %s", os.listdir(app_dir))
    else:
        logger.error("app directory not found at %s", app_dir)
        sys.exit(1)
    
    # Check if main.py exists
    main_path = os.path.join(app_dir, "main.py")
    if os.path.exists(main_path):
        logger.debug("main.py exists at %s", main_path)
    else:
        logger.error("main.py not found at %s", main_path)
        sys.exit(1)
    
    logger.info("Starting server on port 8000...")
    
    # Import after path setup
    import uvicorn
    
    if __name__ == "__main__":
        # Run with explicit host and port
        uvicorn.run(
            "app.main:app", 
            host="0.0.0.0", 
            port=8000, 
            reload=True,
            log_level="debug",
            access_log=True
        )
except Exception as e:
    logger.error("Failed to start server: %s", str(e))
    logger.error("Traceback: %s", traceback.format_exc())
    print(f"Error: {str(e)}")
    print("Traceback:")
    traceback.print_exc()
    sys.exit(1) 