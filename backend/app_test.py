#!/usr/bin/env python3
"""
Simple test script to ensure the application can start correctly.
This script just imports the FastAPI app and starts it with uvicorn.
"""

import os
import sys
import uvicorn

# Set the PORT environment variable if not set
if 'PORT' not in os.environ:
    os.environ['PORT'] = '8080'

print(f"Starting test app on port {os.environ['PORT']}")

if __name__ == "__main__":
    # Start a simple version of the app
    try:
        print("Importing FastAPI app...")
        from app.main import app
        print("App imported successfully!")
        
        print(f"Starting uvicorn server on 0.0.0.0:{os.environ['PORT']}...")
        uvicorn.run(
            "app.main:app", 
            host="0.0.0.0", 
            port=int(os.environ['PORT']),
            log_level="info"
        )
    except Exception as e:
        print(f"Error starting app: {e}")
        sys.exit(1) 