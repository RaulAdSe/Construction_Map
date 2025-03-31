from sqlalchemy import event
from sqlalchemy.engine import Engine
import time
import json
import os
from collections import deque
from datetime import datetime
from typing import Dict, Any, List, Deque

from api.core.logging import logger

# Create logs directory if it doesn't exist
os.makedirs("logs", exist_ok=True)

# Keep track of recent slow queries in memory
MAX_STORED_QUERIES = 100
slow_queries: Deque[Dict[str, Any]] = deque(maxlen=MAX_STORED_QUERIES)

# Threshold for slow queries in seconds
SLOW_QUERY_THRESHOLD = 0.5  # 500ms

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Log query start time before execution."""
    conn.info.setdefault('query_start_time', []).append(time.time())


@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Log query execution time after completion."""
    start_time = conn.info['query_start_time'].pop()
    total_time = time.time() - start_time
    
    # Only process slow queries
    if total_time < SLOW_QUERY_THRESHOLD:
        return
    
    # Extract table name from the query - very simple approach
    table = "unknown"
    if " FROM " in statement:
        try:
            table = statement.split(" FROM ")[1].split(" ")[0].strip().split(".")[0].strip('"')
        except IndexError:
            pass
    
    # Determine operation type
    operation = "unknown"
    if statement.startswith("SELECT"):
        operation = "select"
    elif statement.startswith("INSERT"):
        operation = "insert"
    elif statement.startswith("UPDATE"):
        operation = "update"
    elif statement.startswith("DELETE"):
        operation = "delete"
    
    # Clean query for logging - very basic cleaning
    safe_statement = statement.strip()
    
    # Create query info dictionary
    query_info = {
        "timestamp": datetime.now().isoformat(),
        "query": safe_statement,
        "duration": total_time,
        "table": table,
        "operation": operation,
    }
    
    # Add to in-memory storage
    slow_queries.append(query_info)
    
    # Log the slow query
    logger.warning(
        f"Slow query detected: {operation} on {table} ({total_time:.3f}s)",
        extras={
            "query_info": query_info
        }
    )
    
    # Also write to a dedicated slow query log file
    with open("logs/slow_queries.log", "a") as f:
        f.write(json.dumps(query_info) + "\n")


def get_recent_slow_queries(limit: int = 50) -> List[Dict[str, Any]]:
    """Get the most recent slow queries from memory."""
    return list(slow_queries)[-limit:]


def get_slow_queries_from_log(limit: int = 100) -> List[Dict[str, Any]]:
    """Read slow queries from the log file."""
    if not os.path.exists("logs/slow_queries.log"):
        return []
    
    try:
        with open("logs/slow_queries.log", "r") as f:
            log_lines = f.readlines()
        
        # Parse JSON log lines
        queries = []
        for line in log_lines:
            try:
                query = json.loads(line.strip())
                queries.append(query)
            except json.JSONDecodeError:
                continue
        
        # Sort by timestamp (most recent first)
        queries.sort(key=lambda q: q.get("timestamp", ""), reverse=True)
        
        # Return limited number of queries
        return queries[:limit]
    except Exception as e:
        logger.error(f"Error reading slow query log: {str(e)}")
        return [] 