import time
from sqlalchemy import event
from sqlalchemy.engine import Engine
import logging
import os
import sys

from app.core.config import settings

# Set up logger for database monitoring
logger = logging.getLogger("db_monitoring")
logger.setLevel(logging.INFO)

# Determine if we're running in Cloud Run
in_cloud_run = os.getenv("K_SERVICE") is not None

# Create logs directory if it doesn't exist and we're not in Cloud Run
try:
    os.makedirs(settings.monitoring.LOG_PATH, exist_ok=True)
    log_dir_exists = True
except (OSError, PermissionError):
    log_dir_exists = False
    logger.warning(f"Cannot create logs directory: {settings.monitoring.LOG_PATH}")

# Create handlers
handlers = []

# Always add stdout handler for Cloud Run compatibility
stdout_handler = logging.StreamHandler(sys.stdout)
stdout_handler.setLevel(logging.INFO)
stdout_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
stdout_handler.setFormatter(stdout_formatter)
handlers.append(stdout_handler)

# Add file handler only if we're not in Cloud Run or if we can write to the directory
if not in_cloud_run or (log_dir_exists and os.access(settings.monitoring.LOG_PATH, os.W_OK)):
    try:
        log_path = os.path.join(settings.monitoring.LOG_PATH, "db_queries.log")
        file_handler = logging.FileHandler(log_path)
        file_handler.setLevel(logging.INFO)
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(formatter)
        handlers.append(file_handler)
        logger.info(f"Database query logs will be written to: {log_path}")
    except (OSError, PermissionError) as e:
        logger.warning(f"Cannot create log file, falling back to stdout only: {e}")

# Add all handlers to logger
for handler in handlers:
    logger.addHandler(handler)

# Global variable to store slow queries
slow_queries = []
MAX_SLOW_QUERIES = settings.monitoring.MAX_SLOW_QUERIES
SLOW_QUERY_THRESHOLD = settings.monitoring.SLOW_QUERY_THRESHOLD  # in seconds

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault('query_start_time', []).append(time.time())
    
@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total_time = time.time() - conn.info['query_start_time'].pop(-1)
    
    # Log all queries if in debug mode
    if settings.DEBUG:
        logger.debug(f"Query: {statement}")
        logger.debug(f"Parameters: {parameters}")
        logger.debug(f"Execution time: {total_time:.4f}s")
    
    # Log slow queries
    if total_time > SLOW_QUERY_THRESHOLD:
        query_data = {
            "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
            "query": statement,
            "parameters": str(parameters),
            "duration": total_time,
            "operation_type": get_operation_type(statement)
        }
        
        # Add to global list for in-memory access
        slow_queries.append(query_data)
        if len(slow_queries) > MAX_SLOW_QUERIES:
            slow_queries.pop(0)
        
        # Log to file
        logger.warning(f"Slow query ({total_time:.4f}s): {statement}")
        logger.warning(f"Parameters: {parameters}")

def get_operation_type(query):
    """Determine the type of operation from the query"""
    query = query.strip().upper()
    
    if query.startswith("SELECT"):
        return "SELECT"
    elif query.startswith("INSERT"):
        return "INSERT"
    elif query.startswith("UPDATE"):
        return "UPDATE"
    elif query.startswith("DELETE"):
        return "DELETE"
    elif query.startswith("CREATE"):
        return "CREATE"
    elif query.startswith("ALTER"):
        return "ALTER"
    elif query.startswith("DROP"):
        return "DROP"
    else:
        return "OTHER"

def get_slow_queries(limit=None):
    """Get slow queries from the in-memory store with optional limit"""
    if limit is None or limit > len(slow_queries):
        return slow_queries
    else:
        return slow_queries[-limit:]

def get_slow_queries_from_log(limit=50):
    """Get slow queries from the log file with optional limit (placeholder)"""
    # In a real implementation, this would parse the log file
    # For simplicity, we'll just return an empty list
    return []

logger.info("Database monitoring initialized: SQLAlchemy event listeners are active") 