import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.logging import log_request, log_error

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for logging all HTTP requests and responses.
    
    This middleware:
    1. Logs the start of each request
    2. Times the request processing duration
    3. Logs the completion of each request with status code and duration
    4. Captures and logs any exceptions that occur during request processing
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next):
        # Record start time
        start_time = time.time()
        
        # Process request and catch any exceptions
        try:
            response = await call_next(request)
            # Record end time and calculate duration
            duration = time.time() - start_time
            
            # Log successful request
            log_request(request, response.status_code, duration)
            
            return response
            
        except Exception as e:
            # Record end time and calculate duration
            duration = time.time() - start_time
            
            # Log error
            log_error(e, request, {"duration_ms": round(duration * 1000, 2)})
            
            # Re-raise the exception to be handled by FastAPI exception handlers
            raise 