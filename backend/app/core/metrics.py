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
    """
    Middleware for collecting request metrics.
    
    Collects metrics for each request including count, latency, and errors.
    """
    
    def __init__(self, exclude_paths: Optional[list] = None):
        """
        Initialize the middleware.
        
        Args:
            exclude_paths: List of paths to exclude from metrics collection (e.g., ['/metrics'])
        """
        self.exclude_paths = exclude_paths or ['/metrics']
    
    async def __call__(self, request, call_next):
        # Check if the path should be excluded
        path = request.url.path
        if any(path.startswith(excluded) for excluded in self.exclude_paths):
            return await call_next(request)
        
        method = request.method
        endpoint = path
        REQUEST_IN_PROGRESS.labels(method=method, endpoint=endpoint).inc()
        start_request_timer()
        
        try:
            response = await call_next(request)
            stop_request_timer(method, endpoint, response.status_code)
            return response
        except Exception as e:
            # Record error and re-raise
            record_error(type(e).__name__, endpoint)
            stop_request_timer(method, endpoint, 500)
            raise 