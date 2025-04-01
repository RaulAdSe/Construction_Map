import logging
import json
import sys
import os
from datetime import datetime
from typing import Dict, Any

# Create logs directory if it doesn't exist
os.makedirs("logs", exist_ok=True)

class JsonFormatter(logging.Formatter):
    """
    Formatter that outputs JSON strings after parsing the log record.
    """
    def format(self, record):
        logobj = {}
        
        # Standard log record attributes
        logobj["timestamp"] = datetime.utcnow().isoformat()
        logobj["name"] = record.name
        logobj["level"] = record.levelname
        logobj["message"] = record.getMessage()
        
        # Extra attributes provided in the log record
        if hasattr(record, "extras"):
            logobj.update(record.extras)
        
        # Add exception info if available
        if record.exc_info:
            logobj["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(logobj)


def setup_logging(name: str, level: int = logging.INFO) -> logging.Logger:
    """
    Set up structured logging with both console and file handlers.
    
    Args:
        name: Logger name
        level: Logging level
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Remove any existing handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(JsonFormatter())
    logger.addHandler(console_handler)
    
    # Create file handler
    file_handler = logging.FileHandler(f"logs/{name}.log")
    file_handler.setFormatter(JsonFormatter())
    logger.addHandler(file_handler)
    
    return logger


# Create main application logger
logger = setup_logging("construction_map_api")


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the given name."""
    return setup_logging(name)


def log_with_extras(
    logger: logging.Logger, 
    level: int, 
    message: str, 
    extras: Dict[str, Any] = None
):
    """
    Log a message with extra attributes.
    
    Args:
        logger: Logger instance
        level: Logging level
        message: Log message
        extras: Dictionary of extra attributes to include
    """
    if extras is None:
        extras = {}
    
    # Create a record
    record = logging.LogRecord(
        name=logger.name,
        level=level,
        pathname="",
        lineno=0,
        msg=message,
        args=(),
        exc_info=None
    )
    
    # Add extras
    record.extras = extras
    
    # Process the record through the logger
    if level >= logger.level:
        for handler in logger.handlers:
            handler.handle(record) 