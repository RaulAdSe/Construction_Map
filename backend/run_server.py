import uvicorn
import os
import sys
import logging
import traceback

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
    
    # List files in the app directory to confirm it exists
    app_dir = os.path.join(backend_dir, "app")
    if os.path.exists(app_dir):
        logger.debug("app directory exists, contents: %s", os.listdir(app_dir))
    else:
        logger.error("app directory not found at %s", app_dir)
    
    # Check if main.py exists
    main_path = os.path.join(backend_dir, "app", "main.py")
    if os.path.exists(main_path):
        logger.debug("main.py exists at %s", main_path)
    else:
        logger.error("main.py not found at %s", main_path)
    
    logger.info("Starting server on port 8000...")
    
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