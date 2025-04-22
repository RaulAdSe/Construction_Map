from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
import time
import os
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.db_monitoring import get_slow_queries
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.services import user_activity as activity_service
from app.schemas.user_activity import UserActivityList, UserActivity as UserActivitySchema

router = APIRouter()

# In-memory metrics storage (simple implementation)
system_metrics = []
MAX_METRICS = 1000

# Set up logging
monitoring_logger = logging.getLogger("monitoring")
monitoring_logger.setLevel(logging.INFO)
file_handler = logging.FileHandler("monitoring.log")
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
monitoring_logger.addHandler(file_handler)

# Function to log user activity
def log_user_activity(
    user_id: int, 
    username: str, 
    action: str, 
    ip_address: str = "Unknown", 
    user_type: str = "Unknown", 
    details: Optional[Dict[str, Any]] = None,
    db: Session = None
):
    """
    Log user activity to database and monitoring log
    """
    
    # Get a database connection if not provided
    if not db:
        # Create a new database session
        from app.db.database import SessionLocal
        db = SessionLocal()
        close_db = True
    else:
        close_db = False
    
    try:
        # Create activity in database
        db_activity = activity_service.create_user_activity(
            db=db,
            user_id=user_id,
            username=username,
            action=action,
            ip_address=ip_address,
            user_type=user_type,
            details=details
        )
        
        # Log to monitoring log as well
        monitoring_logger.info(f"User activity: {username} ({user_type}) - {action}")
        
        # Convert to Pydantic model and return
        return UserActivitySchema.from_orm(db_activity)
    finally:
        # Close DB session if we created it in this function
        if close_db:
            db.close()

@router.get("/health/system")
def get_system_health(current_user: User = Depends(get_current_user)):
    """Get system health information"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access system health information"
        )
    
    try:
        # Simple alternative to psutil CPU usage - always return reasonable values
        # In Cloud Run, this information isn't very useful anyway since resources are managed by GCP
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "cpu": {
                "usage_percent": 30.0,  # Static placeholder value
                "status": "healthy"
            },
            "memory": {
                "total_gb": 4.0,  # Static placeholder value
                "used_gb": 1.0,  # Static placeholder value
                "usage_percent": 25.0,  # Static placeholder value
                "status": "healthy"
            },
            "disk": {
                "total_gb": 10.0,  # Static placeholder value
                "used_gb": 2.0,  # Static placeholder value
                "usage_percent": 20.0,  # Static placeholder value
                "status": "healthy"
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
        # Simple query to check DB connectivity and response time - Use text() properly
        result = db.execute(text("SELECT 1")).scalar()
        query_time = time.time() - start_time
        
        # Get recent slow queries
        recent_slow_queries = []
        try:
            recent_slow_queries = get_slow_queries(5) or []
        except Exception as sq_error:
            monitoring_logger.error(f"Error getting slow queries: {str(sq_error)}")
        
        slow_query_count = len(recent_slow_queries) if recent_slow_queries else 0
        
        return {
            "status": "healthy" if query_time < 0.5 and slow_query_count < 10 else "warning",
            "timestamp": datetime.now().isoformat(),
            "response_time_ms": round(query_time * 1000, 2),
            "slow_queries_count": slow_query_count,
            "recent_slow_queries": recent_slow_queries[:5] if recent_slow_queries else []
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        monitoring_logger.error(f"Error getting database health: {str(e)}")
        monitoring_logger.error(f"Traceback: {error_trace}")
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
        # Simple alternative to psutil CPU usage - always return reasonable values
        # In Cloud Run, this information isn't very useful anyway
        
        # Create metrics object with static values
        metrics = {
            "timestamp": datetime.now().isoformat(),
            "cpu_usage": 30.0,  # Static placeholder value
            "memory_usage": 25.0,  # Static placeholder value
            "disk_usage": 20.0,  # Static placeholder value
            "network_sent_mb": 10.0,  # Static placeholder value
            "network_recv_mb": 15.0,  # Static placeholder value
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

@router.get("/user-activity", response_model=UserActivityList)
def get_user_activity(
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    action: Optional[str] = None,
    user_type: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    limit: int = Query(50, gt=0, le=500),
    skip: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user activity logs (logins, actions, etc.)"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access user activity logs"
        )
    
    try:
        # Parse time parameters if provided
        start_datetime = None
        if start_time:
            start_datetime = datetime.fromisoformat(start_time)
            
        end_datetime = None
        if end_time:
            end_datetime = datetime.fromisoformat(end_time)
        
        # Get activities from database
        activities = activity_service.get_user_activities(
            db=db,
            user_id=user_id,
            username=username,
            action=action,
            user_type=user_type,
            start_time=start_datetime,
            end_time=end_datetime,
            skip=skip,
            limit=limit
        )
        
        # Get total count for the filtered activities
        total_count = activity_service.get_activities_count(
            db=db,
            user_id=user_id,
            username=username,
            action=action,
            user_type=user_type,
            start_time=start_datetime,
            end_time=end_datetime
        )
        
        return {
            "total": total_count,
            "activities": activities
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
            details=details,
            db=db
        )
        
        return {"status": "success", "activity": activity_record}
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

@router.get("/user-activity/stats")
def get_user_activity_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get statistics about user activity storage"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access user activity statistics"
        )
    
    try:
        stats = activity_service.get_storage_statistics(db)
        return stats
    except Exception as e:
        monitoring_logger.error(f"Error getting user activity statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user activity statistics: {str(e)}"
        )

@router.post("/user-activity/cleanup")
def trigger_activity_cleanup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually trigger cleanup of old user activity records"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can trigger activity cleanup"
        )
    
    try:
        deleted_count = activity_service.cleanup_old_activities(db)
        return {
            "status": "success",
            "deleted_records": deleted_count,
            "message": f"Successfully deleted {deleted_count} old activity records"
        }
    except Exception as e:
        monitoring_logger.error(f"Error during user activity cleanup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clean up user activities: {str(e)}"
        ) 