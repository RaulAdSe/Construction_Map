import time
from sqlalchemy import event
from sqlalchemy.engine import Engine
import logging

# Set up logger for database monitoring
logger = logging.getLogger("db_monitoring")
logger.setLevel(logging.INFO)

# Create a file handler for database queries
file_handler = logging.FileHandler("db_queries.log")
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Global variable to store slow queries
slow_queries = []
MAX_SLOW_QUERIES = 100
SLOW_QUERY_THRESHOLD = 0.5  # in seconds

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault('query_start_time', []).append(time.time())

@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - conn.info['query_start_time'].pop()
    
    # Log all queries for debugging
    logger.info(f"Query: {statement}, Parameters: {parameters}, Execution time: {total:.4f}s")
    
    # Track slow queries
    if total > SLOW_QUERY_THRESHOLD:
        # Extract the table name (simple regex-free approach)
        table_name = "unknown"
        statement_upper = statement.upper()
        
        # Determine operation type
        if statement_upper.startswith("SELECT"):
            operation = "SELECT"
        elif statement_upper.startswith("INSERT"):
            operation = "INSERT"
        elif statement_upper.startswith("UPDATE"):
            operation = "UPDATE"
        elif statement_upper.startswith("DELETE"):
            operation = "DELETE"
        else:
            operation = "OTHER"
            
        # Try to extract table name
        if "FROM" in statement_upper:
            from_parts = statement_upper.split("FROM")[1].strip().split()
            if from_parts:
                table_name = from_parts[0].strip('"`[]').lower()
        elif "INTO" in statement_upper:
            into_parts = statement_upper.split("INTO")[1].strip().split()
            if into_parts:
                table_name = into_parts[0].strip('"`[]').lower()
        elif "UPDATE" in statement_upper:
            update_parts = statement_upper.split("UPDATE")[1].strip().split()
            if update_parts:
                table_name = update_parts[0].strip('"`[]').lower()
                
        # Log slow query
        logger.warning(f"SLOW QUERY ({total:.4f}s) - {operation} on {table_name}: {statement}")
        
        # Add to in-memory list with timestamp
        slow_query = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "duration": round(total, 4),
            "operation": operation,
            "table": table_name,
            "query": statement,
            "parameters": str(parameters)
        }
        
        slow_queries.append(slow_query)
        
        # Keep list from growing too large
        if len(slow_queries) > MAX_SLOW_QUERIES:
            slow_queries.pop(0)

def get_slow_queries(limit=50):
    """Return the most recent slow queries, limited by the specified number."""
    return slow_queries[-limit:]

print("Database monitoring initialized: SQLAlchemy event listeners are active") 