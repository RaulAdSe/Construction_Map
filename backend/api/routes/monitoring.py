from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from datetime import datetime, timedelta
import psutil
import os
import time
import json
from typing import List, Optional, Dict, Any

from api.deps import get_db, get_current_admin_user
from api.models.user import User
from api.models.metrics import Metric
from api.schemas.metrics import MetricCreate, Metric as MetricSchema, MetricsList, SystemMetrics
from api.core.logging import logger
from api.core.db_monitoring import get_recent_slow_queries, get_slow_queries_from_log
from api.services.notification import NotificationService
from api.schemas.notification import NotificationCreate

router = APIRouter()

# In-memory request counter for basic metrics
request_counts = {
    "total": 0,
    "by_endpoint": {},
    "errors": 0,
    "last_minute_requests": []
}

@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "construction_map_api",
        "version": "1.0.0"
    }

@router.get("/health/db")
async def db_health_check(db: Session = Depends(get_db)):
    """Database health check endpoint."""
    try:
        start_time = time.time()
        result = db.execute(text("SELECT 1")).scalar()
        query_time = time.time() - start_time
        
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "database": "construction_map",
            "query_time_ms": round(query_time * 1000, 2),
            "result": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database health check failed: {str(e)}"
        )

@router.get("/health/system", dependencies=[Depends(get_current_admin_user)])
async def system_health_check():
    """System health check endpoint - admin only."""
    try:
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "cpu": {
                "percent": psutil.cpu_percent(interval=0.5),
                "cores": psutil.cpu_count()
            },
            "memory": {
                "total_mb": round(memory.total / (1024 * 1024), 2),
                "available_mb": round(memory.available / (1024 * 1024), 2),
                "percent_used": memory.percent
            },
            "disk": {
                "total_gb": round(disk.total / (1024 * 1024 * 1024), 2),
                "free_gb": round(disk.free / (1024 * 1024 * 1024), 2),
                "percent_used": disk.percent
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"System health check failed: {str(e)}"
        )

@router.post("/metrics", dependencies=[Depends(get_current_admin_user)])
async def create_metric(metric: MetricCreate, db: Session = Depends(get_db)):
    """Create a new metric - admin only."""
    db_metric = Metric(
        name=metric.name,
        value=metric.value,
        tags=metric.tags
    )
    db.add(db_metric)
    db.commit()
    db.refresh(db_metric)
    return db_metric

@router.get("/metrics", response_model=MetricsList, dependencies=[Depends(get_current_admin_user)])
async def get_metrics(
    db: Session = Depends(get_db),
    name: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    """Get metrics with optional filtering - admin only."""
    query = db.query(Metric)
    
    if name:
        query = query.filter(Metric.name == name)
    
    if start_time:
        query = query.filter(Metric.timestamp >= start_time)
    
    if end_time:
        query = query.filter(Metric.timestamp <= end_time)
    
    total = query.count()
    metrics = query.order_by(Metric.timestamp.desc()).offset(offset).limit(limit).all()
    
    return {"metrics": metrics, "total": total}

@router.get("/metrics/system", response_model=SystemMetrics, dependencies=[Depends(get_current_admin_user)])
async def get_system_metrics(db: Session = Depends(get_db)):
    """Get current system metrics - admin only."""
    # Clean up old requests from last_minute_requests
    current_time = time.time()
    request_counts["last_minute_requests"] = [
        req for req in request_counts["last_minute_requests"] 
        if current_time - req["timestamp"] < 60
    ]
    
    # Calculate requests per minute
    requests_per_minute = len(request_counts["last_minute_requests"])
    
    # Calculate error rate
    if request_counts["total"] > 0:
        error_rate = (request_counts["errors"] / request_counts["total"]) * 100
    else:
        error_rate = 0.0
    
    # Get the count of active users (users who logged in within the last 24 hours)
    yesterday = datetime.now() - timedelta(days=1)
    # This is a placeholder - adjust according to your actual user activity tracking
    active_users = 0  # Replace with actual query
    
    # Get system metrics
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    return {
        "cpu_percent": psutil.cpu_percent(interval=0.5),
        "memory_percent": memory.percent,
        "disk_percent": disk.percent,
        "api_requests_per_minute": float(requests_per_minute),
        "error_rate_percent": error_rate,
        "active_users": active_users,
        "timestamp": datetime.now()
    }

@router.get("/logs", dependencies=[Depends(get_current_admin_user)])
async def get_logs(
    limit: int = Query(100, ge=1, le=1000),
    level: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    search: Optional[str] = None
):
    """Get application logs with filtering - admin only."""
    log_path = "logs/construction_map_api.log"
    
    if not os.path.exists(log_path):
        return {"logs": [], "total": 0}
    
    try:
        with open(log_path, "r") as f:
            log_lines = f.readlines()
        
        # Parse JSON log lines
        logs = []
        for line in log_lines:
            try:
                log_entry = json.loads(line.strip())
                logs.append(log_entry)
            except json.JSONDecodeError:
                # Skip malformed log lines
                continue
        
        # Apply filters
        filtered_logs = logs
        
        # Filter by level
        if level:
            filtered_logs = [log for log in filtered_logs if log.get("level", "").lower() == level.lower()]
        
        # Filter by timestamp
        if start_time:
            try:
                start_dt = datetime.fromisoformat(start_time)
                filtered_logs = [
                    log for log in filtered_logs 
                    if datetime.fromisoformat(log.get("timestamp", "2000-01-01T00:00:00")) >= start_dt
                ]
            except ValueError:
                pass
        
        if end_time:
            try:
                end_dt = datetime.fromisoformat(end_time)
                filtered_logs = [
                    log for log in filtered_logs 
                    if datetime.fromisoformat(log.get("timestamp", "2999-12-31T23:59:59")) <= end_dt
                ]
            except ValueError:
                pass
        
        # Filter by search text
        if search:
            search = search.lower()
            filtered_logs = [
                log for log in filtered_logs 
                if search in json.dumps(log).lower()
            ]
        
        # Sort by timestamp (newest first)
        filtered_logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        # Apply limit
        limited_logs = filtered_logs[:limit]
        
        return {
            "logs": limited_logs,
            "total": len(filtered_logs)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading logs: {str(e)}"
        )

@router.get("/logs/errors", dependencies=[Depends(get_current_admin_user)])
async def get_error_logs(
    limit: int = Query(100, ge=1, le=1000),
    start_time: Optional[str] = None,
    end_time: Optional[str] = None
):
    """Get error logs - admin only."""
    return await get_logs(limit=limit, level="ERROR", start_time=start_time, end_time=end_time)

@router.get("/logs/queries", dependencies=[Depends(get_current_admin_user)])
async def get_slow_queries(
    limit: int = Query(50, ge=1, le=1000),
    from_log: bool = False
):
    """Get slow database queries - admin only."""
    try:
        if from_log:
            queries = get_slow_queries_from_log(limit)
        else:
            queries = get_recent_slow_queries(limit)
        
        return {
            "queries": queries,
            "total": len(queries)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving slow queries: {str(e)}"
        )

@router.get("/test-email-notification")
async def test_email_notification(db: Session = Depends(get_db)):
    """Test endpoint to send an email notification to the admin user."""
    try:
        # Find the admin user
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            return {"status": "error", "message": "Admin user not found"}
            
        # Create a test notification
        notification_data = NotificationCreate(
            user_id=admin_user.id,
            message="This is a test notification",
            link="/dashboard",
            notification_type="test",
            event_id=None,
            comment_id=None
        )
        
        # Create the notification (which should trigger an email)
        notification = NotificationService.create_notification(db, notification_data)
        
        # Return status
        return {
            "status": "success", 
            "message": "Test notification created and email should be sent",
            "user": {
                "id": admin_user.id,
                "username": admin_user.username,
                "email": admin_user.email
            }
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": f"Error: {str(e)}",
            "traceback": traceback.format_exc()
        }

# Middleware function to track requests - will be registered in main.py
async def track_request_middleware(request: Request, call_next):
    """Middleware to track API requests for metrics."""
    start_time = time.time()
    path = request.url.path
    method = request.method
    
    # Track the request
    request_counts["total"] += 1
    endpoint = f"{method}:{path}"
    request_counts["by_endpoint"][endpoint] = request_counts["by_endpoint"].get(endpoint, 0) + 1
    
    # Process the request
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Record request in last_minute_requests
        request_counts["last_minute_requests"].append({
            "endpoint": endpoint,
            "status_code": response.status_code,
            "duration": process_time,
            "timestamp": time.time()
        })
        
        # If response status is an error (4xx or 5xx), increment error count
        if response.status_code >= 400:
            request_counts["errors"] += 1
            
        return response
    except Exception as e:
        # Count exceptions as errors
        request_counts["errors"] += 1
        raise 