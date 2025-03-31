from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
import psutil
import time
import os
from sqlalchemy.orm import Session

from app.core.db_monitoring import get_slow_queries
from app.api.deps import get_db, get_current_user
from app.models.user import User

router = APIRouter()

# In-memory metrics storage (simple implementation)
system_metrics = []
MAX_METRICS = 1000

# In-memory user activity tracking
user_activities = []
MAX_USER_ACTIVITIES = 100

# Set up logging
monitoring_logger = logging.getLogger("monitoring")
monitoring_logger.setLevel(logging.INFO)
file_handler = logging.FileHandler("monitoring.log")
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
monitoring_logger.addHandler(file_handler)

# Function to log user activity
def log_user_activity(user_id, username, action, ip_address="Unknown", user_type="Unknown", details=None):
    activity = {
        "timestamp": datetime.now().isoformat(),
        "user_id": user_id,
        "username": username,
        "action": action,
        "ip_address": ip_address,
        "user_type": user_type,
        "details": details or {}
    }
    
    user_activities.append(activity)
    if len(user_activities) > MAX_USER_ACTIVITIES:
        user_activities.pop(0)
    
    monitoring_logger.info(f"User activity: {activity['username']} ({activity['user_type']}) - {activity['action']}")
    return activity

@router.get("/health/system")
def get_system_health(current_user: User = Depends(get_current_user)):
    """Get system health information"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access system health information"
        )
    
    try:
        # Get CPU, memory, and disk usage
        cpu_usage = psutil.cpu_percent(interval=0.5)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "status": "healthy" if cpu_usage < 80 and memory.percent < 80 and disk.percent < 80 else "warning",
            "timestamp": datetime.now().isoformat(),
            "cpu": {
                "usage_percent": cpu_usage,
                "status": "healthy" if cpu_usage < 80 else "warning"
            },
            "memory": {
                "total_gb": round(memory.total / (1024**3), 2),
                "used_gb": round(memory.used / (1024**3), 2),
                "usage_percent": memory.percent,
                "status": "healthy" if memory.percent < 80 else "warning"
            },
            "disk": {
                "total_gb": round(disk.total / (1024**3), 2),
                "used_gb": round(disk.used / (1024**3), 2),
                "usage_percent": disk.percent,
                "status": "healthy" if disk.percent < 80 else "warning"
            }
        }
    except Exception as e:
        monitoring_logger.error(f"Error getting system health: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get system health: {str(e)}"
        )

@router.get("/health/db")
def get_db_health(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get database health information"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access database health information"
        )
    
    try:
        # Measure query response time
        start_time = time.time()
        # Simple query to check DB connectivity and response time
        db.execute("SELECT 1").fetchall()
        query_time = time.time() - start_time
        
        # Get recent slow queries
        recent_slow_queries = get_slow_queries(5)
        slow_query_count = len(recent_slow_queries)
        
        return {
            "status": "healthy" if query_time < 0.5 and slow_query_count < 10 else "warning",
            "timestamp": datetime.now().isoformat(),
            "response_time_ms": round(query_time * 1000, 2),
            "slow_queries_count": slow_query_count,
            "recent_slow_queries": recent_slow_queries[:5] if recent_slow_queries else []
        }
    except Exception as e:
        monitoring_logger.error(f"Error getting database health: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get database health: {str(e)}"
        )

@router.get("/metrics/system")
def get_system_metrics(current_user: User = Depends(get_current_user)):
    """Get current system metrics"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access system metrics"
        )
    
    try:
        # Get CPU, memory, and disk metrics
        cpu_usage = psutil.cpu_percent(interval=0.5)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get network metrics
        network = psutil.net_io_counters()
        
        # Create metrics object
        metrics = {
            "timestamp": datetime.now().isoformat(),
            "cpu_usage": cpu_usage,
            "memory_usage": memory.percent,
            "disk_usage": disk.percent,
            "network_sent_mb": round(network.bytes_sent / (1024**2), 2),
            "network_recv_mb": round(network.bytes_recv / (1024**2), 2),
            "api_requests": 0,  # Placeholder for actual API request tracking
            "error_rate": 0,     # Placeholder for actual error rate tracking
            "active_users": 0    # Placeholder for active users tracking
        }
        
        # Store metrics
        system_metrics.append(metrics)
        if len(system_metrics) > MAX_METRICS:
            system_metrics.pop(0)
        
        return metrics
    except Exception as e:
        monitoring_logger.error(f"Error getting system metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get system metrics: {str(e)}"
        )

@router.get("/user-activity")
def get_user_activity(
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    action: Optional[str] = None,
    user_type: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    limit: int = Query(50, gt=0, le=500),
    current_user: User = Depends(get_current_user)
):
    """Get user activity logs (logins, actions, etc.)"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access user activity logs"
        )
    
    try:
        # Filter activities based on query parameters
        filtered_activities = user_activities.copy()
        
        if user_id:
            filtered_activities = [a for a in filtered_activities if a["user_id"] == user_id]
            
        if username:
            filtered_activities = [a for a in filtered_activities if username.lower() in a["username"].lower()]
            
        if action:
            filtered_activities = [a for a in filtered_activities if action.lower() in a["action"].lower()]
            
        if user_type:
            filtered_activities = [a for a in filtered_activities if user_type.lower() == a["user_type"].lower()]
            
        if start_time:
            start = datetime.fromisoformat(start_time)
            filtered_activities = [
                a for a in filtered_activities 
                if datetime.fromisoformat(a["timestamp"]) >= start
            ]
            
        if end_time:
            end = datetime.fromisoformat(end_time)
            filtered_activities = [
                a for a in filtered_activities 
                if datetime.fromisoformat(a["timestamp"]) <= end
            ]
            
        # Sort by timestamp (newest first) and apply limit
        filtered_activities.sort(key=lambda x: x["timestamp"], reverse=True)
        filtered_activities = filtered_activities[:limit]
        
        return {
            "total": len(filtered_activities),
            "activities": filtered_activities
        }
    except Exception as e:
        monitoring_logger.error(f"Error getting user activity: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user activity: {str(e)}"
        )

@router.post("/user-activity")
def record_user_activity(
    activity: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a user activity"""
    try:
        user_id = activity.get("user_id", current_user.id)
        username = activity.get("username", current_user.username)
        action = activity.get("action", "unknown_action")
        ip_address = activity.get("ip_address", "Unknown")
        user_type = "admin" if current_user.is_admin else "member"
        details = activity.get("details", {})
        
        activity_record = log_user_activity(
            user_id=user_id,
            username=username,
            action=action,
            ip_address=ip_address,
            user_type=user_type,
            details=details
        )
        
        return activity_record
    except Exception as e:
        monitoring_logger.error(f"Error recording user activity: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record user activity: {str(e)}"
        )

@router.get("/logs")
def get_logs(
    level: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, gt=0, le=1000),
    current_user: User = Depends(get_current_user)
):
    """Get application logs"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access application logs"
        )
    
    try:
        logs = []
        log_file = "monitoring.log"
        
        if os.path.exists(log_file):
            with open(log_file, "r") as f:
                log_lines = f.readlines()
            
            # Apply filters
            for line in log_lines:
                # Skip lines that don't match level filter
                if level and level.upper() not in line:
                    continue
                
                # Skip lines that don't match search filter
                if search and search not in line:
                    continue
                
                # Parse timestamp
                try:
                    timestamp_str = line.split(" - ")[0].strip()
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S,%f")
                    
                    # Skip lines outside time range
                    if start_time:
                        start = datetime.fromisoformat(start_time)
                        if timestamp < start:
                            continue
                    
                    if end_time:
                        end = datetime.fromisoformat(end_time)
                        if timestamp > end:
                            continue
                    
                    # Parse log parts
                    parts = line.split(" - ", 2)
                    if len(parts) >= 3:
                        level_str = parts[1].strip()
                        message = parts[2].strip()
                        
                        logs.append({
                            "timestamp": timestamp.isoformat(),
                            "level": level_str,
                            "message": message,
                            "request_id": "N/A"  # Placeholder for request ID
                        })
                except Exception as e:
                    print(f"Error parsing log line: {e}")
                    continue
            
            # Apply limit after all filters
            logs = logs[-limit:]
        
        return {
            "total": len(logs),
            "logs": logs
        }
    except Exception as e:
        monitoring_logger.error(f"Error getting logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get logs: {str(e)}"
        )

@router.get("/logs/queries")
def get_slow_queries_endpoint(
    limit: int = Query(50, gt=0, le=500),
    from_log: bool = False,
    current_user: User = Depends(get_current_user)
):
    """Get slow database queries"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access slow query logs"
        )
    
    try:
        if from_log:
            # Read from log file (not implemented in this example)
            return {"queries": [], "total": 0}
        else:
            # Get from in-memory store
            queries = get_slow_queries(limit)
            return {
                "queries": queries,
                "total": len(queries)
            }
    except Exception as e:
        monitoring_logger.error(f"Error getting slow queries: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get slow queries: {str(e)}"
        ) 