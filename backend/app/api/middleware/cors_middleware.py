"""
CORS Middleware

This middleware ensures that all responses have proper CORS headers.
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.api.core.cors import ALLOWED_ORIGINS

class CORSMiddleware(BaseHTTPMiddleware):
    """
    Custom CORS middleware that adds CORS headers to all responses.
    """
    
    async def dispatch(self, request: Request, call_next):
        """
        Process the request and add CORS headers to the response.
        
        Args:
            request: The incoming request
            call_next: The next middleware or route handler
            
        Returns:
            Response with CORS headers
        """
        # Get origin from request
        origin = request.headers.get("origin", "")
        request_method = request.method
        
        # Special handling for OPTIONS requests (preflight)
        if request_method == "OPTIONS":
            # Create response with appropriate headers
            response = Response(content="", status_code=200)
            
            # If origin matches the origin of special domains always allow it
            if "coordino.servitecingenieria.com" in origin or "localhost:3000" in origin:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
                response.headers["Access-Control-Allow-Headers"] = "*"
                response.headers["Access-Control-Expose-Headers"] = "Content-Length, Content-Range, Content-Type, Content-Disposition, X-Total-Count, Access-Control-Allow-Origin"
                response.headers["Access-Control-Max-Age"] = "600"  # Cache preflight for 10 minutes
            # For other origins, check if they're in the allowed list
            elif origin in ALLOWED_ORIGINS:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
                response.headers["Access-Control-Allow-Headers"] = "*"
                response.headers["Access-Control-Expose-Headers"] = "Content-Length, Content-Range, Content-Type, Content-Disposition, X-Total-Count, Access-Control-Allow-Origin"
                response.headers["Access-Control-Max-Age"] = "600"  # Cache preflight for 10 minutes
                
            # Always set Vary: Origin
            response.headers["Vary"] = "Origin"
            
            return response
        
        # For non-OPTIONS requests, process the request
        response = await call_next(request)
        
        # Special handling for specific domains
        if "coordino.servitecingenieria.com" in origin or "localhost:3000" in origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Expose-Headers"] = "Content-Length, Content-Range, Content-Type, Content-Disposition, X-Total-Count, Access-Control-Allow-Origin"
        # For other origins, check if they're in the allowed list
        elif origin in ALLOWED_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Expose-Headers"] = "Content-Length, Content-Range, Content-Type, Content-Disposition, X-Total-Count, Access-Control-Allow-Origin"
            
        # Always set Vary: Origin
        response.headers["Vary"] = "Origin"
        
        return response
        
# Special handler for OPTIONS requests
async def handle_options(request: Request):
    """
    Handle OPTIONS requests with proper CORS headers.
    
    Args:
        request: The incoming request
        
    Returns:
        Response with CORS headers
    """
    origin = request.headers.get("origin", "")
    
    # Create response with appropriate headers
    response = Response(content="", status_code=200)
    
    # Special handling for specific domains
    if "coordino.servitecingenieria.com" in origin or "localhost:3000" in origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Expose-Headers"] = "Content-Length, Content-Range, Content-Type, Content-Disposition, X-Total-Count, Access-Control-Allow-Origin"
        response.headers["Access-Control-Max-Age"] = "600"  # Cache preflight for 10 minutes
    # For other origins, check if they're in the allowed list
    elif origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Expose-Headers"] = "Content-Length, Content-Range, Content-Type, Content-Disposition, X-Total-Count, Access-Control-Allow-Origin"
        response.headers["Access-Control-Max-Age"] = "600"  # Cache preflight for 10 minutes
        
    # Always set Vary: Origin
    response.headers["Vary"] = "Origin"
    
    return response 