"""
Prometheus metrics collection module.
This module provides metrics collection for FastAPI using Prometheus client.
"""

import time
from typing import Callable, Dict, Optional
from prometheus_client import Counter, Histogram, Gauge, Summary, CollectorRegistry, generate_latest
import threading
import logging

# Setup logging
logger = logging.getLogger(__name__)

# Create a metric registry
REGISTRY = CollectorRegistry()

# Define metrics
REQUEST_COUNT = Counter(
    'app_request_count', 
    'Number of requests received',
    ['method', 'endpoint', 'status_code'],
    registry=REGISTRY
)

REQUEST_LATENCY = Histogram(
    'app_request_latency_seconds', 
    'Request latency in seconds',
    ['method', 'endpoint'],
    buckets=[0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10],
    registry=REGISTRY
)

REQUEST_IN_PROGRESS = Gauge(
    'app_requests_in_progress',
    'Number of requests currently being processed',
    ['method', 'endpoint'],
    registry=REGISTRY
)

DATABASE_QUERY_COUNT = Counter(
    'app_database_query_count',
    'Number of database queries executed',
    ['operation', 'table'],
    registry=REGISTRY
)

DATABASE_QUERY_LATENCY = Histogram(
    'app_database_query_latency_seconds',
    'Database query latency in seconds',
    ['operation', 'table'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1],
    registry=REGISTRY
)

MEMORY_USAGE = Gauge(
    'app_memory_usage_bytes',
    'Memory usage in bytes',
    registry=REGISTRY
)

CPU_USAGE = Gauge(
    'app_cpu_usage_percent',
    'CPU usage in percent',
    registry=REGISTRY
)

ACTIVE_USERS = Gauge(
    'app_active_users',
    'Number of active users in the last 15 minutes',
    registry=REGISTRY
)

ERROR_COUNT = Counter(
    'app_error_count',
    'Number of errors occurred',
    ['type', 'endpoint'],
    registry=REGISTRY
)

# Store endpoint timers in a thread-local variable
_thread_local = threading.local()

def start_request_timer() -> None:
    """Start a timer for the current request."""
    _thread_local.start_time = time.time()

def stop_request_timer(method: str, endpoint: str, status_code: int) -> float:
    """
    Stop the timer for the current request and record the metrics.
    
    Args:
        method: HTTP method (GET, POST, etc.)
        endpoint: Request URL path
        status_code: HTTP status code
        
    Returns:
        Request processing time in seconds
    """
    total_time = time.time() - _thread_local.start_time
    REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(total_time)
    REQUEST_COUNT.labels(method=method, endpoint=endpoint, status_code=status_code).inc()
    REQUEST_IN_PROGRESS.labels(method=method, endpoint=endpoint).dec()
    return total_time

def track_database_query(operation: str, table: str, duration: float) -> None:
    """
    Record metrics for a database query.
    
    Args:
        operation: Query operation type (SELECT, INSERT, UPDATE, DELETE)
        table: Target database table
        duration: Query execution time in seconds
    """
    DATABASE_QUERY_COUNT.labels(operation=operation, table=table).inc()
    DATABASE_QUERY_LATENCY.labels(operation=operation, table=table).observe(duration)

def record_database_query(query: str, parameters: Optional[Dict] = None, duration: float = 0.0) -> None:
    """
    Record metrics for a database query with query text.
    
    Args:
        query: SQL query text
        parameters: Query parameters (optional)
        duration: Query execution time in seconds
    """
    # Extract operation type from query
    operation = "UNKNOWN"
    if query:
        query_upper = query.strip().upper()
        if query_upper.startswith("SELECT"):
            operation = "SELECT"
        elif query_upper.startswith("INSERT"):
            operation = "INSERT"
        elif query_upper.startswith("UPDATE"):
            operation = "UPDATE"
        elif query_upper.startswith("DELETE"):
            operation = "DELETE"
        elif query_upper.startswith("CREATE"):
            operation = "CREATE"
        elif query_upper.startswith("ALTER"):
            operation = "ALTER"
    
    # Extract table name if possible (simplified)
    table = "unknown"
    try:
        # Very basic table name extraction
        words = query.strip().upper().split()
        if operation == "SELECT" and "FROM" in words:
            from_index = words.index("FROM")
            if from_index + 1 < len(words):
                table = words[from_index + 1].strip(',;')
        elif operation == "INSERT" and "INTO" in words:
            into_index = words.index("INTO")
            if into_index + 1 < len(words):
                table = words[into_index + 1].strip(',;')
        elif operation == "UPDATE":
            if len(words) > 1:
                table = words[1].strip(',;')
        elif operation == "DELETE" and "FROM" in words:
            from_index = words.index("FROM")
            if from_index + 1 < len(words):
                table = words[from_index + 1].strip(',;')
    except Exception as e:
        logger.warning(f"Error extracting table name from query: {e}")
    
    # Record the database query metrics
    track_database_query(operation, table, duration)
    
    # Log the query for debugging in development environments
    log_level = logger.debug if duration < 0.5 else logger.info
    log_level(f"DB Query ({operation} on {table}) took {duration:.4f}s: {query[:100]}...")

def record_error(error_type: str, endpoint: str) -> None:
    """
    Record an error occurrence.
    
    Args:
        error_type: Type of error
        endpoint: Endpoint where the error occurred
    """
    ERROR_COUNT.labels(type=error_type, endpoint=endpoint).inc()

def update_system_metrics(memory_bytes: float, cpu_percent: float) -> None:
    """
    Update system resource metrics.
    
    Args:
        memory_bytes: Memory usage in bytes
        cpu_percent: CPU usage percentage
    """
    MEMORY_USAGE.set(memory_bytes)
    CPU_USAGE.set(cpu_percent)

def update_database_metrics(connection_count: int, active_queries: int, idle_connections: int = 0, 
                            dead_tuples: int = 0, idle_in_transaction: int = 0) -> None:
    """
    Update database performance metrics.
    
    Args:
        connection_count: Total number of database connections
        active_queries: Number of active queries
        idle_connections: Number of idle connections
        dead_tuples: Number of dead tuples (for vacuum analysis)
        idle_in_transaction: Number of connections idle in transaction
    """
    # Define gauge metrics for these database stats if not already defined
    global DB_CONNECTION_COUNT, DB_ACTIVE_QUERIES, DB_IDLE_CONNECTIONS, DB_DEAD_TUPLES, DB_IDLE_IN_TRANSACTION
    
    if not globals().get('DB_CONNECTION_COUNT'):
        DB_CONNECTION_COUNT = Gauge(
            'app_db_connection_count',
            'Number of database connections',
            registry=REGISTRY
        )
    
    if not globals().get('DB_ACTIVE_QUERIES'):
        DB_ACTIVE_QUERIES = Gauge(
            'app_db_active_queries',
            'Number of active database queries',
            registry=REGISTRY
        )
    
    if not globals().get('DB_IDLE_CONNECTIONS'):
        DB_IDLE_CONNECTIONS = Gauge(
            'app_db_idle_connections',
            'Number of idle database connections',
            registry=REGISTRY
        )
    
    if not globals().get('DB_DEAD_TUPLES'):
        DB_DEAD_TUPLES = Gauge(
            'app_db_dead_tuples',
            'Number of dead tuples',
            registry=REGISTRY
        )
    
    if not globals().get('DB_IDLE_IN_TRANSACTION'):
        DB_IDLE_IN_TRANSACTION = Gauge(
            'app_db_idle_in_transaction',
            'Number of connections idle in transaction',
            registry=REGISTRY
        )
    
    # Update the metrics
    DB_CONNECTION_COUNT.set(connection_count)
    DB_ACTIVE_QUERIES.set(active_queries)
    DB_IDLE_CONNECTIONS.set(idle_connections)
    DB_DEAD_TUPLES.set(dead_tuples)
    DB_IDLE_IN_TRANSACTION.set(idle_in_transaction)

def update_active_users(count: int) -> None:
    """
    Update the active users metric.
    
    Args:
        count: Number of active users
    """
    ACTIVE_USERS.set(count)

def collect_metrics() -> bytes:
    """
    Collect all metrics and return them in Prometheus format.
    
    Returns:
        Prometheus metrics in text format.
    """
    return generate_latest(REGISTRY)

class MetricsMiddleware:
    """Middleware for collecting request metrics."""

    def __init__(self, app=None):
        self.app = app
        self.exclude_paths = ["/metrics", "/health"]

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope["path"]
        # Check if the path should be excluded
        if any(path.startswith(excluded) for excluded in self.exclude_paths):
            await self.app(scope, receive, send)
            return
        
        method = scope.get("method", "UNKNOWN")
        endpoint = path
        REQUEST_IN_PROGRESS.labels(method=method, endpoint=endpoint).inc()
        start_request_timer()
        
        # Create a new send function to intercept the response status
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_code = message["status"]
                stop_request_timer(method, endpoint, status_code)
            await send(message)
        
        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            # Record error and re-raise
            record_error(type(e).__name__, endpoint)
            stop_request_timer(method, endpoint, 500)
            raise 