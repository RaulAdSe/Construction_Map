#!/usr/bin/env python3
"""
Patch script to modify the main.py file at runtime to handle CORS_ORIGINS properly
in Google Cloud Run environment.
"""

import sys
import os
import importlib.util
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("patch_main")

logger.info("Patching main.py to handle CORS properly")

# Path to the main app
main_module_path = os.path.join(os.getcwd(), "app", "main.py")

if not os.path.exists(main_module_path):
    logger.error(f"Cannot find main.py at {main_module_path}")
    sys.exit(1)

# Load the main module
spec = importlib.util.spec_from_file_location("app.main", main_module_path)
main_module = importlib.util.module_from_spec(spec)
sys.modules["app.main"] = main_module
spec.loader.exec_module(main_module)

# Check if we need to allow all origins
if os.environ.get("ALLOW_ALL_ORIGINS", "").lower() == "true":
    logger.info("ALLOW_ALL_ORIGINS is true, modifying CORS settings")
    
    # Get the FastAPI app instance
    app = main_module.app
    
    # Find and remove existing CORS middleware
    for i, middleware in enumerate(app.user_middleware):
        if "CORSMiddleware" in str(middleware.cls):
            logger.info(f"Found CORS middleware at index {i}")
            # Remove the middleware
            app.user_middleware.pop(i)
            app.middleware_stack = None  # This will force FastAPI to rebuild the middleware stack
            break
    
    logger.info("Adding modified CORS middleware with ['*'] as allow_origins")
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allow all origins
        allow_credentials=True,
        allow_methods=["*"],  # Allow all methods
        allow_headers=["*"],  # Allow all headers
        expose_headers=["Content-Length", "Content-Range", "Content-Type", "Content-Disposition",
                        "X-Total-Count", "Access-Control-Allow-Origin"],
        max_age=600,
    )
    logger.info("CORS middleware patched successfully")
else:
    logger.info("ALLOW_ALL_ORIGINS is not true, keeping original CORS settings")

logger.info("Patch completed successfully") 