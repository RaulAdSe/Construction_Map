import logging
import os
import sys
import json
import time
from datetime import datetime
import structlog
from typing import Any, Dict, Optional

from app.core.config import settings

# Define log level from environment or default to INFO
LOG_LEVEL = getattr(logging, settings.monitoring.LOG_LEVEL.upper(), logging.INFO)

# Configure structlog processors
pre_chain = [
    # Add the log level and a timestamp to the event_dict if the log entry
    # is not from structlog
    structlog.stdlib.add_log_level,
    structlog.stdlib.add_logger_name,
    # Add extra attributes to the log entry
    structlog.processors.TimeStamper(fmt="iso"),
]

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(indent=None),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

# Create logs directory if it doesn't exist
os.makedirs(settings.monitoring.LOG_PATH, exist_ok=True)

# Configure standard logging
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(settings.monitoring.LOG_PATH, "app.log")),
    ],
)

# Get a logger instance
logger = structlog.get_logger()

def log_request(request, response_status, duration):
    """
    Log HTTP request details.
    
    Args:
        request: The FastAPI request object
        response_status (int): HTTP response status code
        duration (float): Request processing time in seconds
    """
    request_data = {
        "method": request.method,
        "path": request.url.path,
        "client_ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "status_code": response_status,
        "duration_ms": round(duration * 1000, 2),
    }
    
    # Add query parameters if any
    if request.query_params:
        request_data["query_params"] = dict(request.query_params)
    
    # Log the request
    logger.info("http_request", **request_data)

def log_error(error, request=None, context=None):
    """
    Log application errors.
    
    Args:
        error: The exception object
        request: Optional FastAPI request object
        context: Optional additional context
    """
    error_data = {
        "error_type": error.__class__.__name__,
        "error_message": str(error),
    }
    
    # Add request info if available
    if request:
        error_data.update({
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else None,
        })
    
    # Add additional context if provided
    if context:
        error_data.update(context)
    
    # Log the error
    logger.error("application_error", **error_data, exc_info=True)

def log_database_event(event_type, query=None, duration=None, params=None):
    """
    Log database-related events.
    
    Args:
        event_type (str): Type of database event (query, connection, error)
        query (str, optional): SQL query string
        duration (float, optional): Query execution time in seconds
        params (dict, optional): Query parameters
    """
    event_data = {
        "event_type": event_type,
    }
    
    if query:
        event_data["query"] = query
    
    if duration:
        event_data["duration_ms"] = round(duration * 1000, 2)
    
    if params:
        event_data["params"] = params
    
    # Log the database event
    logger.info("database_event", **event_data)

def log_audit(user_id, action, resource_type, resource_id, details=None):
    """
    Log audit events for security and compliance.
    
    Args:
        user_id (str): ID of the user performing the action
        action (str): The action performed (create, read, update, delete)
        resource_type (str): Type of resource being acted upon
        resource_id (str): ID of the resource
        details (dict, optional): Additional details about the action
    """
    audit_data = {
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "timestamp": datetime.now().isoformat(),
    }
    
    if details:
        audit_data["details"] = details
    
    # Log the audit event
    logger.info("audit_event", **audit_data)

def get_logger(name=None):
    """Get a configured structlog logger."""
    return structlog.get_logger(name) 