"""
CORS Helper Module

This module provides utility functions for consistent CORS header management.
"""
from fastapi import Request
from fastapi.responses import JSONResponse

# List of allowed origins
ALLOWED_ORIGINS = [
    "https://construction-map-frontend-ypzdt6srya-uc.a.run.app",
    "https://construction-map-frontend-77413952899.us-central1.run.app",
    "https://coordino.servitecingenieria.com",
    "http://localhost:3000"
]

def get_cors_headers(request: Request) -> dict:
    """
    Get appropriate CORS headers based on the origin in the request.
    
    Args:
        request: The incoming request
        
    Returns:
        Dictionary of CORS headers
    """
    origin = request.headers.get("origin", "")
    
    # If origin is in allowed origins, use it; otherwise use default
    # More permissive approach - allow any origin from the list
    if origin in ALLOWED_ORIGINS:
        response_origin = origin
    else:
        # Default to the first origin if not in allowed list
        response_origin = ALLOWED_ORIGINS[0]
    
    # Get requested headers if available
    request_headers = request.headers.get("access-control-request-headers", "*")
    
    return {
        "Access-Control-Allow-Origin": response_origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": request_headers,
        "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type, Content-Disposition, X-Total-Count, Access-Control-Allow-Origin",
        "Access-Control-Max-Age": "600",  # Cache preflight for 10 minutes
        "Vary": "Origin"
    }

def cors_response(request: Request, status_code: int, content: dict) -> JSONResponse:
    """
    Create a response with proper CORS headers.
    
    Args:
        request: The incoming request
        status_code: HTTP status code for the response
        content: The response body content
        
    Returns:
        JSONResponse with proper CORS headers
    """
    return JSONResponse(
        status_code=status_code,
        content=content,
        headers=get_cors_headers(request)
    ) 