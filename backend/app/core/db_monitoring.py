import time
from sqlalchemy import event
from sqlalchemy.engine import Engine
import logging
import os

from app.core.config import settings
# Import metrics module
from app.core.metrics import record_database_query, update_database_metrics

# Set up logger for database monitoring
logger = logging.getLogger("db_monitoring")
logger.setLevel(logging.INFO)

# Create logs directory if it doesn't exist
os.makedirs(settings.monitoring.LOG_PATH, exist_ok=True)

# Create a file handler for database queries
log_path = os.path.join(settings.monitoring.LOG_PATH, "db_queries.log")
file_handler = logging.FileHandler(log_path)
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

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
    
    # Record metrics for this query
    record_database_query(statement, parameters, total_time)
    
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

def get_database_metrics():
    """Return summary metrics about database operations"""
    # Update metrics in the Prometheus registry
    # Provide the required parameters for update_database_metrics:
    # connection_count, active_queries, idle_connections, dead_tuples, idle_in_transaction
    connection_count = len(slow_queries)  # Use as a proxy for connection count
    update_database_metrics(
        connection_count=connection_count,
        active_queries=0,  # We don't have real-time data for this in this implementation
        idle_connections=0,  # We don't have real-time data for this in this implementation
        dead_tuples=0,      # We don't have real-time data for this in this implementation
        idle_in_transaction=0  # We don't have real-time data for this in this implementation
    )
    
    return {
        "slow_queries_count": len(slow_queries),
        "recent_slow_queries": get_slow_queries(5),
        "slow_query_threshold": SLOW_QUERY_THRESHOLD
    }

print("Database monitoring initialized: SQLAlchemy event listeners are active") 